/**
 * 最小 PDF 文档写入器。
 *
 * 只覆盖「每页一张整页位图」这一种结构：
 *   Catalog → Pages → Page → (Contents 画整页图片) + Image XObject
 * 没有引入第三方 PDF 库，产出是标准 PDF 1.7，体积由位图编码方式决定。
 *
 * 对象编号固定分配，便于一次生成完整交叉引用表：
 *   1 Catalog / 2 Pages / 3 Info / 之后每页占 3 个对象（Page、Contents、Image）
 */

import { asBlobPart } from '@/lib/binary';
import { formatPdfDate, toPdfTextString } from './text';
import type { PdfDocumentMetadata, PdfPageInput } from './types';
import { formatPdfNumber } from './units';

const HEADER = '%PDF-1.7\n';

/** 4 个高位字节让工具把文件判定为二进制（PDF 规范推荐） */
const BINARY_MARKER = new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]);

const FIRST_PAGE_OBJECT = 4;
const OBJECTS_PER_PAGE = 3;

const encoder = new TextEncoder();

/** 按顺序累积字节片段，避免反复拼接大数组 */
class ByteAccumulator {
  private readonly parts: Uint8Array[] = [];

  private total = 0;

  get length(): number {
    return this.total;
  }

  pushText(text: string): void {
    const bytes = encoder.encode(text);
    this.parts.push(bytes);
    this.total += bytes.length;
  }

  pushBytes(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.total += bytes.length;
  }

  toUint8Array(): Uint8Array {
    const output = new Uint8Array(this.total);
    let offset = 0;
    for (const part of this.parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }
}

/** Info 字典：只写有值的字段 */
function buildInfoDictionary(metadata: PdfDocumentMetadata): string {
  const entries: string[] = [];
  const push = (key: string, value?: string) => {
    const text = value?.trim();
    if (text) entries.push(`/${key} ${toPdfTextString(text)}`);
  };

  push('Title', metadata.title);
  push('Author', metadata.author);
  push('Subject', metadata.subject);
  push('Keywords', metadata.keywords);
  push('Creator', metadata.creator);
  push('Producer', metadata.producer);
  entries.push(`/CreationDate ${toPdfTextString(metadata.creationDate ?? formatPdfDate(new Date()))}`);

  return `<< ${entries.join(' ')} >>`;
}

export class PdfEmptyDocumentError extends Error {
  constructor() {
    super('PDF_EMPTY_DOCUMENT');
    this.name = 'PdfEmptyDocumentError';
  }
}

export class PdfDocumentBuilder {
  private readonly pages: PdfPageInput[] = [];

  private readonly metadata: PdfDocumentMetadata;

  constructor(metadata: PdfDocumentMetadata = {}) {
    this.metadata = metadata;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** 追加一页；位图会被拉伸到整页大小 */
  addImagePage(page: PdfPageInput): void {
    this.pages.push(page);
  }

  /** 序列化为 PDF 文件 */
  build(): Blob {
    if (this.pages.length === 0) throw new PdfEmptyDocumentError();

    const output = new ByteAccumulator();
    /** 每个对象在文件中的字节偏移，索引即对象号 */
    const offsets: number[] = [];

    const writeObject = (objectNumber: number, parts: Array<string | Uint8Array>) => {
      offsets[objectNumber] = output.length;
      output.pushText(`${objectNumber} 0 obj\n`);
      for (const part of parts) {
        if (typeof part === 'string') output.pushText(part);
        else output.pushBytes(part);
      }
      output.pushText('\nendobj\n');
    };

    output.pushText(HEADER);
    output.pushBytes(BINARY_MARKER);

    const pageObjectNumbers = this.pages.map((_, index) => FIRST_PAGE_OBJECT + index * OBJECTS_PER_PAGE);
    const kids = pageObjectNumbers.map(number => `${number} 0 R`).join(' ');

    writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    writeObject(2, [`<< /Type /Pages /Count ${this.pages.length} /Kids [${kids}] >>`]);
    writeObject(3, [buildInfoDictionary(this.metadata)]);

    this.pages.forEach((page, index) => {
      const pageNumber = pageObjectNumbers[index];
      const contentNumber = pageNumber + 1;
      const imageNumber = pageNumber + 2;
      const { box, image } = page;

      const content = encoder.encode(
        `q\n${formatPdfNumber(box.width)} 0 0 ${formatPdfNumber(box.height)} 0 0 cm\n/Im0 Do\nQ\n`,
      );

      writeObject(pageNumber, [
        `<< /Type /Page /Parent 2 0 R` +
          ` /MediaBox [0 0 ${formatPdfNumber(box.width)} ${formatPdfNumber(box.height)}]` +
          ` /Resources << /XObject << /Im0 ${imageNumber} 0 R >> /ProcSet [/PDF /ImageC] >>` +
          ` /Contents ${contentNumber} 0 R >>`,
      ]);

      writeObject(contentNumber, [`<< /Length ${content.length} >>\nstream\n`, content, '\nendstream']);

      writeObject(imageNumber, [
        `<< /Type /XObject /Subtype /Image` +
          ` /Width ${image.width} /Height ${image.height}` +
          ` /ColorSpace /${image.colorSpace}` +
          ` /BitsPerComponent ${image.bitsPerComponent}` +
          (image.filter ? ` /Filter /${image.filter}` : '') +
          ` /Interpolate true /Length ${image.data.length} >>\nstream\n`,
        image.data,
        '\nendstream',
      ]);
    });

    const totalObjects = FIRST_PAGE_OBJECT + this.pages.length * OBJECTS_PER_PAGE;
    const xrefOffset = output.length;

    // 交叉引用表：每项固定 20 字节，偏移不足位补零
    output.pushText(`xref\n0 ${totalObjects}\n0000000000 65535 f \n`);
    for (let number = 1; number < totalObjects; number += 1) {
      output.pushText(`${String(offsets[number] ?? 0).padStart(10, '0')} 00000 n \n`);
    }

    output.pushText(
      `trailer\n<< /Size ${totalObjects} /Root 1 0 R /Info 3 0 R >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`,
    );

    return new Blob([asBlobPart(output.toUint8Array())], { type: 'application/pdf' });
  }
}
