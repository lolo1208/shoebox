import {
  AppWindow,
  ArrowLeftRight,
  BadgeCheck,
  Binary,
  Braces,
  Camera,
  Clapperboard,
  Clock,
  Code2,
  Contact,
  Crop,
  Diff,
  FileImage,
  FileText,
  FileVideo2,
  Film,
  Fingerprint,
  Gauge,
  Globe,
  Grid,
  Hash,
  Image as ImageIcon,
  ImageMinus,
  Images,
  Info,
  KeyRound,
  Layers,
  LayoutGrid,
  Lock,
  Music,
  Network,
  Palette,
  Plug,
  QrCode,
  ScanEye,
  ScanSearch,
  Scaling,
  Send,
  Server,
  ShieldCheck,
  Spline,
  Stamp,
  Tags,
  Terminal,
  Type,
} from 'lucide-react';
import { lazy, type ComponentType } from 'react';
import { CategoryId, type CategoryDefinition, type LazyToolComponent } from '@/types/tool';

// 工具实现全部按需加载（React.lazy + 动态 import）：
// 首页只展示名称/图标/描述，不再下载任何工具代码；
// 打开某个工具时才拉取它自己的 chunk。
const lazyTool = (load: () => Promise<{ default: ComponentType }>): ComponentType => {
  const Component = lazy(load) as LazyToolComponent;
  Component.preload = () => {
    void load();
  };
  return Component;
};

const JsonFormatter = lazyTool(() => import('@/features/tools/text/JsonFormatter'));
const TimestampConverter = lazyTool(() => import('@/features/tools/text/TimestampConverter'));
const TextDiff = lazyTool(() => import('@/features/tools/text/TextDiff'));
const HttpStatusCode = lazyTool(() => import('@/features/tools/text/HttpStatusCode'));
const ImageConverter = lazyTool(() => import('@/features/tools/image/image-converter'));
const ImageResizer = lazyTool(() => import('@/features/tools/image/ImageResizer'));
const ImageCropper = lazyTool(() => import('@/features/tools/image/ImageCropper'));
const QrCodeGenerator = lazyTool(() => import('@/features/tools/image/QrCodeGenerator'));
const BackgroundRemover = lazyTool(() => import('@/features/tools/image/BackgroundRemover'));
const WatermarkGenerator = lazyTool(() => import('@/features/tools/image/WatermarkGenerator'));
const PixelateCensor = lazyTool(() => import('@/features/tools/image/PixelateCensor'));
const ImageGridSlicer = lazyTool(() => import('@/features/tools/image/ImageGridSlicer'));
const ImageComposition = lazyTool(() => import('@/features/tools/image/ImageComposition'));
const ExifTool = lazyTool(() => import('@/features/tools/image/ExifTool'));
const FaviconGenerator = lazyTool(() => import('@/features/tools/image/FaviconGenerator'));
const MarkdownToImage = lazyTool(() => import('@/features/tools/image/MarkdownToImage'));
const PaletteExtractor = lazyTool(() => import('@/features/tools/image/palette-extractor'));
const HashSuite = lazyTool(() => import('@/features/tools/security/HashSuite'));
const CodecTool = lazyTool(() => import('@/features/tools/security/codec'));
const SecretGenerator = lazyTool(() => import('@/features/tools/security/secret-generator'));
const UuidGenerator = lazyTool(() => import('@/features/tools/security/UuidGenerator'));
const TextCrypto = lazyTool(() => import('@/features/tools/security/TextCrypto'));
const CodeRunner = lazyTool(() => import('@/features/tools/developer/CodeRunner'));
const ProgrammerCalculator = lazyTool(() => import('@/features/tools/developer/ProgrammerCalculator'));
const EasingVisualizer = lazyTool(() => import('@/features/tools/developer/EasingVisualizer'));
const TexturePacker = lazyTool(() => import('@/features/tools/developer/TexturePacker'));
const BitmapFontGenerator = lazyTool(() => import('@/features/tools/developer/BitmapFontGenerator'));
const HttpRequestTester = lazyTool(() => import('@/features/tools/network/HttpRequestTester'));
const DnsTxtQuery = lazyTool(() => import('@/features/tools/network/DnsTxtQuery'));
const CheckHost = lazyTool(() => import('@/features/tools/network/CheckHost'));
const WhoisLookup = lazyTool(() => import('@/features/tools/network/WhoisLookup'));
const SpeedTest = lazyTool(() => import('@/features/tools/network/SpeedTest'));
const RandomPortGenerator = lazyTool(() => import('@/features/tools/network/RandomPortGenerator'));
const AudioConverter = lazyTool(() => import('@/features/tools/media/AudioConverter'));
const VideoCommandGenerator = lazyTool(() => import('@/features/tools/media/VideoCommandGenerator'));
const VideoFrameExtractor = lazyTool(() => import('@/features/tools/media/video-frame-extractor'));
const VideoToGif = lazyTool(() => import('@/features/tools/media/video-to-gif'));
const MediaInfoViewer = lazyTool(() => import('@/features/tools/media/MediaInfoViewer'));
const MusicTagEditor = lazyTool(() => import('@/features/tools/media/MusicTagEditor'));

/**
 * 工具注册表。
 *
 * 排序规则：分类与分类内工具均按预估使用频率从高到低排列，
 * 首页、侧边栏、分类页共用此顺序，新增工具时按热度插入对应位置即可。
 */
export const TOOL_CATALOG: CategoryDefinition[] = [
  {
    id: CategoryId.TEXT,
    nameKey: 'cat.text',
    descriptionKey: 'cat.text.desc',
    icon: FileText,
    tools: [
      {
        id: 'json-format',
        nameKey: 'tool.json_format.name',
        descriptionKey: 'tool.json_format.desc',
        icon: Braces,
        component: JsonFormatter,
        layoutClass: 'w-full',
      },
      {
        id: 'timestamp',
        nameKey: 'tool.timestamp.name',
        descriptionKey: 'tool.timestamp.desc',
        icon: Clock,
        component: TimestampConverter,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'text-diff',
        nameKey: 'tool.text_diff.name',
        descriptionKey: 'tool.text_diff.desc',
        icon: Diff,
        component: TextDiff,
        layoutClass: 'w-full',
      },
      {
        id: 'http-status',
        nameKey: 'tool.http_status.name',
        descriptionKey: 'tool.http_status.desc',
        icon: BadgeCheck,
        component: HttpStatusCode,
        layoutClass: 'max-w-5xl mx-auto',
      },
    ],
  },
  {
    id: CategoryId.IMAGE,
    nameKey: 'cat.image',
    descriptionKey: 'cat.image.desc',
    icon: ImageIcon,
    tools: [
      {
        id: 'img-convert',
        nameKey: 'tool.img_convert.name',
        descriptionKey: 'tool.img_convert.desc',
        icon: Images,
        component: ImageConverter,
        layoutClass: 'w-full',
      },
      {
        id: 'img-resize',
        nameKey: 'tool.img_resize.name',
        descriptionKey: 'tool.img_resize.desc',
        icon: Scaling,
        component: ImageResizer,
        layoutClass: 'w-full',
      },
      {
        id: 'img-crop',
        nameKey: 'tool.img_crop.name',
        descriptionKey: 'tool.img_crop.desc',
        icon: Crop,
        component: ImageCropper,
        layoutClass: 'w-full',
      },
      {
        id: 'palette',
        nameKey: 'tool.palette.name',
        descriptionKey: 'tool.palette.desc',
        icon: Palette,
        component: PaletteExtractor,
        layoutClass: 'w-full',
      },
      {
        id: 'qr-gen',
        nameKey: 'tool.qr_gen.name',
        descriptionKey: 'tool.qr_gen.desc',
        icon: QrCode,
        component: QrCodeGenerator,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'bg-remove',
        nameKey: 'tool.bg_remove.name',
        descriptionKey: 'tool.bg_remove.desc',
        icon: ImageMinus,
        component: BackgroundRemover,
        layoutClass: 'w-full',
      },
      {
        id: 'watermark',
        nameKey: 'tool.watermark.name',
        descriptionKey: 'tool.watermark.desc',
        icon: Stamp,
        component: WatermarkGenerator,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'img-censor',
        nameKey: 'tool.pixelate.name',
        descriptionKey: 'tool.pixelate.desc',
        icon: ScanEye,
        component: PixelateCensor,
        layoutClass: 'w-full',
      },
      {
        id: 'img-slice',
        nameKey: 'tool.img_slice.name',
        descriptionKey: 'tool.img_slice.desc',
        icon: Grid,
        component: ImageGridSlicer,
        layoutClass: 'w-full',
      },
      {
        id: 'img-comp',
        nameKey: 'tool.img_comp.name',
        descriptionKey: 'tool.img_comp.desc',
        icon: Layers,
        component: ImageComposition,
        layoutClass: 'w-full',
      },
      {
        id: 'exif',
        nameKey: 'tool.exif.name',
        descriptionKey: 'tool.exif.desc',
        icon: ScanSearch,
        component: ExifTool,
        layoutClass: 'w-full',
      },
      {
        id: 'favicon-gen',
        nameKey: 'tool.fav_gen.name',
        descriptionKey: 'tool.fav_gen.desc',
        icon: AppWindow,
        component: FaviconGenerator,
        layoutClass: 'w-full',
      },
      {
        id: 'md-to-img',
        nameKey: 'tool.md_to_img.name',
        descriptionKey: 'tool.md_to_img.desc',
        icon: FileImage,
        component: MarkdownToImage,
        layoutClass: 'w-full',
      },
    ],
  },
  {
    id: CategoryId.SECURITY,
    nameKey: 'cat.security',
    descriptionKey: 'cat.security.desc',
    icon: ShieldCheck,
    tools: [
      {
        id: 'hash-suite',
        nameKey: 'tool.hash.name',
        descriptionKey: 'tool.hash.desc',
        icon: Hash,
        component: HashSuite,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'codec',
        nameKey: 'tool.codec.name',
        descriptionKey: 'tool.codec.desc',
        icon: ArrowLeftRight,
        component: CodecTool,
        layoutClass: 'w-full',
      },
      {
        id: 'secret-gen',
        nameKey: 'tool.secret_gen.name',
        descriptionKey: 'tool.secret_gen.desc',
        icon: KeyRound,
        component: SecretGenerator,
        layoutClass: 'max-w-6xl mx-auto',
      },
      {
        id: 'uuid-gen',
        nameKey: 'tool.uuid_gen.name',
        descriptionKey: 'tool.uuid_gen.desc',
        icon: Fingerprint,
        component: UuidGenerator,
        layoutClass: 'max-w-3xl mx-auto',
      },
      {
        id: 'text-crypto',
        nameKey: 'tool.text_crypto.name',
        descriptionKey: 'tool.text_crypto.desc',
        icon: Lock,
        component: TextCrypto,
        layoutClass: 'w-full',
      },
    ],
  },
  {
    id: CategoryId.DEVELOPER,
    nameKey: 'cat.developer',
    descriptionKey: 'cat.developer.desc',
    icon: Code2,
    tools: [
      {
        id: 'code-runner',
        nameKey: 'tool.code_runner.name',
        descriptionKey: 'tool.code_runner.desc',
        icon: Terminal,
        component: CodeRunner,
        layoutClass: 'w-full',
      },
      {
        id: 'programmer-calc',
        nameKey: 'tool.pcalc.name',
        descriptionKey: 'tool.pcalc.desc',
        icon: Binary,
        component: ProgrammerCalculator,
        layoutClass: 'max-w-6xl mx-auto',
      },
      {
        id: 'easing-vis',
        nameKey: 'tool.easing_vis.name',
        descriptionKey: 'tool.easing_vis.desc',
        icon: Spline,
        component: EasingVisualizer,
        layoutClass: 'max-w-7xl mx-auto',
      },
      {
        id: 'texture-packer',
        nameKey: 'tool.texture_packer.name',
        descriptionKey: 'tool.texture_packer.desc',
        icon: LayoutGrid,
        component: TexturePacker,
        layoutClass: 'w-full',
      },
      {
        id: 'bmfont-gen',
        nameKey: 'tool.bmfont_gen.name',
        descriptionKey: 'tool.bmfont_gen.desc',
        icon: Type,
        component: BitmapFontGenerator,
        layoutClass: 'w-full',
      },
    ],
  },
  {
    id: CategoryId.NETWORK,
    nameKey: 'cat.network',
    descriptionKey: 'cat.network.desc',
    icon: Network,
    tools: [
      {
        id: 'http-req',
        nameKey: 'tool.http_req.name',
        descriptionKey: 'tool.http_req.desc',
        icon: Send,
        component: HttpRequestTester,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'dns-txt',
        nameKey: 'tool.dns_txt.name',
        descriptionKey: 'tool.dns_txt.desc',
        icon: Server,
        component: DnsTxtQuery,
        layoutClass: 'w-full',
      },
      {
        id: 'check-host',
        nameKey: 'tool.check_host.name',
        descriptionKey: 'tool.check_host.desc',
        icon: Globe,
        component: CheckHost,
        layoutClass: 'w-full',
      },
      {
        id: 'whois',
        nameKey: 'tool.whois.name',
        descriptionKey: 'tool.whois.desc',
        icon: Contact,
        component: WhoisLookup,
        layoutClass: 'max-w-5xl mx-auto',
      },
      {
        id: 'speed-test',
        nameKey: 'tool.speed_test.name',
        descriptionKey: 'tool.speed_test.desc',
        icon: Gauge,
        component: SpeedTest,
        layoutClass: 'w-full',
      },
      {
        id: 'random-port',
        nameKey: 'tool.random_port.name',
        descriptionKey: 'tool.random_port.desc',
        icon: Plug,
        component: RandomPortGenerator,
        layoutClass: 'max-w-5xl mx-auto',
      },
    ],
  },
  {
    id: CategoryId.MEDIA,
    nameKey: 'cat.media',
    descriptionKey: 'cat.media.desc',
    icon: Clapperboard,
    tools: [
      {
        id: 'media-info',
        nameKey: 'tool.media_info.name',
        descriptionKey: 'tool.media_info.desc',
        icon: Info,
        component: MediaInfoViewer,
        layoutClass: 'w-full',
      },
      {
        id: 'video-frame',
        nameKey: 'tool.video_frame.name',
        descriptionKey: 'tool.video_frame.desc',
        icon: Camera,
        component: VideoFrameExtractor,
        layoutClass: 'w-full',
      },
      {
        id: 'video-gif',
        nameKey: 'tool.video_gif.name',
        descriptionKey: 'tool.video_gif.desc',
        icon: FileVideo2,
        component: VideoToGif,
        layoutClass: 'w-full',
      },
      {
        id: 'audio-convert',
        nameKey: 'tool.audio_convert.name',
        descriptionKey: 'tool.audio_convert.desc',
        icon: Music,
        component: AudioConverter,
        layoutClass: 'w-full',
      },
      {
        id: 'video-cmd',
        nameKey: 'tool.video_cmd.name',
        descriptionKey: 'tool.video_cmd.desc',
        icon: Film,
        component: VideoCommandGenerator,
        layoutClass: 'w-full',
      },
      {
        id: 'music-tag',
        nameKey: 'tool.music_tag.name',
        descriptionKey: 'tool.music_tag.desc',
        icon: Tags,
        component: MusicTagEditor,
        layoutClass: 'w-full',
      },
    ],
  },
];
