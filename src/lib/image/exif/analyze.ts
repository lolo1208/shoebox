
import {
  type MetaReport,
  type RiskKey,
  type TiffState,
  ascii,
  createTiffState,
  dmsToDecimal,
  formatGpsTime,
  normalizeExifDate,
} from './tiff';
import { heifBrand, parseGif, parseHeif, parseJpeg, parsePng, parseWebp } from './containers';

/* ------------------------------------------------------------------ */
/* 分析入口 */
/* ------------------------------------------------------------------ */

const RISK_SERIAL = new Set(['SerialNumber', 'BodySerialNumber', 'LensSerialNumber', 'CameraOwnerName']);
const RISK_OWNER = new Set(['Artist', 'Copyright', 'OwnerName', 'CameraOwnerName', 'XPAuthor']);

function finalize(report: MetaReport, state: TiffState): void {
  report.orientation = state.orientation;
  report.hasThumbnail = state.hasThumbnail || report.hasThumbnail;
  report.tags = state.tags;

  if (state.gps.lat && state.gps.lng) {
    report.gps = {
      latitude: dmsToDecimal(state.gps.lat, state.gps.latRef),
      longitude: dmsToDecimal(state.gps.lng, state.gps.lngRef),
      altitude: state.gps.alt !== undefined
        ? state.gps.altRef === 1
          ? -state.gps.alt
          : state.gps.alt
        : undefined,
      timestamp: state.gps.time
        ? `${state.gps.date ? normalizeExifDate(state.gps.date) + ' ' : ''}${formatGpsTime(state.gps.time)}`.trim()
        : state.gps.date
          ? normalizeExifDate(state.gps.date)
          : undefined
    };
  }

  if (state.gps.altRef === 1 && state.gps.alt) {
    const altTag = report.tags.find(t => t.name === 'GPSAltitude');
    if (altTag && !altTag.value.startsWith('-')) altTag.value = `-${altTag.value}`;
  }

  const names = new Set(report.tags.map(t => t.name));
  const risks: RiskKey[] = [];
  if (report.gps) risks.push('gps');
  if (report.hasThumbnail) risks.push('thumbnail');
  if (report.tags.some(t => RISK_SERIAL.has(t.name))) risks.push('serial');
  if (report.tags.some(t => RISK_OWNER.has(t.name))) risks.push('owner');
  if (names.has('Software')) risks.push('software');
  if (state.hasMakerNote) risks.push('makernote');
  if (report.xmp.length) risks.push('xmp');
  if (report.comments.length) risks.push('comment');
  if (report.iptc) risks.push('iptc');
  report.risks = Array.from(new Set(risks));

  // 去除完全重复的行（部分相机会在 IFD0 与 Exif IFD 重复写入）
  const seen = new Set<string>();
  report.tags = report.tags.filter(t => {
    const key = `${t.group}|${t.name}|${t.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function analyzeFile(file: File): Promise<MetaReport> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const report: MetaReport = {
    format: 'Unknown',
    mime: file.type || 'application/octet-stream',
    fileSize: file.size,
    tags: [],
    xmp: [],
    comments: [],
    iptc: false,
    hasThumbnail: false,
    metadataBytes: 0,
    risks: [],
    supported: false,
    inPlaceOnly: false,
    wipes: [],
    locationWipes: [],
    warnings: []
  };
  const state = createTiffState();

  try {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
      parseJpeg(buffer, report, state);
      report.supported = true;
    } else if (buffer.length >= 8 && buffer[0] === 0x89 && ascii(buffer, 1, 3) === 'PNG') {
      await parsePng(buffer, report, state);
      report.supported = true;
    } else if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
      parseWebp(buffer, report, state);
      report.supported = true;
    } else if (buffer.length >= 6 && (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a')) {
      parseGif(buffer, report);
      report.supported = true;
    } else if (heifBrand(buffer)) {
      parseHeif(buffer, report, state);
      report.supported = true;
    } else {
      report.warnings.push('unsupported');
    }
  } catch (error) {
    report.warnings.push(error instanceof Error ? error.message : String(error));
  }

  finalize(report, state);
  return report;
}

/* ------------------------------------------------------------------ */
/* Metadata strippers                                                  */
/* ------------------------------------------------------------------ */
