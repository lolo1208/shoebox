
import React, { useMemo } from 'react';
import { 
  Image as ImageIcon, 
  Code2, 
  Braces, 
  KeyRound, 
  Fingerprint, 
  Hash, 
  QrCode,
  FileImage, 
  Activity,
  FileType,
  Stamp,
  Scaling,
  Crop,
  Grid,
  Layers,
  FileVideo,
  Music,
  ImageMinus,
  Clock,
  Terminal,
  Globe,
  Gauge,
  Network,
  FileText,
  Film,
  Tags,
  LayoutGrid,
  Type
} from 'lucide-react';
import { Category, CategoryId } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// Tool Components
import JsonFormatter from '../components/tools/JsonFormatter';
import PasswordGenerator from '../components/tools/PasswordGenerator';
import UuidGenerator from '../components/tools/UuidGenerator';
import Md5Generator from '../components/tools/Md5Generator';
import QrCodeGenerator from '../components/tools/QrCodeGenerator';
import ImageConverter from '../components/tools/ImageConverter';
import EasingVisualizer from '../components/tools/EasingVisualizer';
import MarkdownToImage from '../components/tools/MarkdownToImage';
import WatermarkGenerator from '../components/tools/WatermarkGenerator';
import ImageResizer from '../components/tools/ImageResizer';
import ImageCropper from '../components/tools/ImageCropper';
import ImageGridSlicer from '../components/tools/ImageGridSlicer';
import ImageComposition from '../components/tools/ImageComposition';
import VideoCommandGenerator from '../components/tools/VideoCommandGenerator';
import AudioConverter from '../components/tools/AudioConverter';
import BackgroundRemover from '../components/tools/BackgroundRemover';
import TimestampConverter from '../components/tools/TimestampConverter';
import CodeRunner from '../components/tools/CodeRunner';
import CheckHost from '../components/tools/CheckHost';
import SpeedTest from '../components/tools/SpeedTest';
import MusicTagEditor from '../components/tools/MusicTagEditor';
import TexturePacker from '../components/tools/TexturePacker';
import BitmapFontGenerator from '../components/tools/BitmapFontGenerator';

export const useTools = () => {
  const { t } = useLanguage();

  const categories: Category[] = useMemo(() => [
    {
      id: CategoryId.IMAGE,
      name: t('cat.image'),
      icon: ImageIcon,
      description: t('cat.image.desc'),
      tools: [
        {
          id: 'img-convert',
          name: t('tool.img_convert.name'),
          description: t('tool.img_convert.desc'),
          icon: FileImage,
          component: <ImageConverter />,
          layoutClass: 'w-full'
        },
        {
          id: 'img-resize',
          name: t('tool.img_resize.name'),
          description: t('tool.img_resize.desc'),
          icon: Scaling,
          component: <ImageResizer />,
          layoutClass: 'w-full'
        },
        {
          id: 'img-crop',
          name: t('tool.img_crop.name'),
          description: t('tool.img_crop.desc'),
          icon: Crop,
          component: <ImageCropper />,
          layoutClass: 'w-full'
        },
        {
          id: 'img-slice',
          name: t('tool.img_slice.name'),
          description: t('tool.img_slice.desc'),
          icon: Grid,
          component: <ImageGridSlicer />,
          layoutClass: 'w-full'
        },
        {
          id: 'bg-remove',
          name: t('tool.bg_remove.name'),
          description: t('tool.bg_remove.desc'),
          icon: ImageMinus,
          component: <BackgroundRemover />,
          layoutClass: 'w-full'
        },
        {
          id: 'img-comp',
          name: t('tool.img_comp.name'),
          description: t('tool.img_comp.desc'),
          icon: Layers,
          component: <ImageComposition />,
          layoutClass: 'w-full'
        },
        {
          id: 'watermark',
          name: t('tool.watermark.name'),
          description: t('tool.watermark.desc'),
          icon: Stamp,
          component: <WatermarkGenerator />,
          layoutClass: 'max-w-5xl mx-auto'
        },
        {
          id: 'md-to-img',
          name: t('tool.md_to_img.name'),
          description: t('tool.md_to_img.desc'),
          icon: FileType,
          component: <MarkdownToImage />,
          layoutClass: 'w-full'
        },
        {
          id: 'qr-gen',
          name: t('tool.qr_gen.name'),
          description: t('tool.qr_gen.desc'),
          icon: QrCode,
          component: <QrCodeGenerator />,
          layoutClass: 'max-w-5xl mx-auto'
        }
      ]
    },
    {
      id: CategoryId.MEDIA,
      name: t('cat.media'),
      icon: FileVideo,
      description: t('cat.media.desc'),
      tools: [
        {
          id: 'audio-convert',
          name: t('tool.audio_convert.name'),
          description: t('tool.audio_convert.desc'),
          icon: Music,
          component: <AudioConverter />,
          layoutClass: 'w-full'
        },
        {
          id: 'video-cmd',
          name: t('tool.video_cmd.name'),
          description: t('tool.video_cmd.desc'),
          icon: Film,
          component: <VideoCommandGenerator />,
          layoutClass: 'w-full'
        },
        {
          id: 'music-tag',
          name: t('tool.music_tag.name'),
          description: t('tool.music_tag.desc'),
          icon: Tags,
          component: <MusicTagEditor />,
          layoutClass: 'w-full'
        }
      ]
    },
    {
      id: CategoryId.TEXT_DATA,
      name: t('cat.text_data'),
      icon: FileText,
      description: t('cat.text_data.desc'),
      tools: [
        {
          id: 'timestamp',
          name: t('tool.timestamp.name'),
          description: t('tool.timestamp.desc'),
          icon: Clock,
          component: <TimestampConverter />,
          layoutClass: 'max-w-5xl mx-auto'
        },
        {
          id: 'password-gen',
          name: t('tool.password_gen.name'),
          description: t('tool.password_gen.desc'),
          icon: KeyRound,
          component: <PasswordGenerator />,
          layoutClass: 'max-w-3xl mx-auto'
        },
        {
          id: 'uuid-gen',
          name: t('tool.uuid_gen.name'),
          description: t('tool.uuid_gen.desc'),
          icon: Fingerprint,
          component: <UuidGenerator />,
          layoutClass: 'max-w-3xl mx-auto'
        },
        {
          id: 'md5-hash',
          name: t('tool.md5_hash.name'),
          description: t('tool.md5_hash.desc'),
          icon: Hash,
          component: <Md5Generator />,
          layoutClass: 'max-w-3xl mx-auto'
        }
      ]
    },
    {
      id: CategoryId.DEVELOPER,
      name: t('cat.developer'),
      icon: Code2,
      description: t('cat.developer.desc'),
      tools: [
        {
          id: 'json-format',
          name: t('tool.json_format.name'),
          description: t('tool.json_format.desc'),
          icon: Braces,
          component: <JsonFormatter />,
          layoutClass: 'w-full'
        },
        {
          id: 'texture-packer',
          name: t('tool.texture_packer.name'),
          description: t('tool.texture_packer.desc'),
          icon: LayoutGrid,
          component: <TexturePacker />,
          layoutClass: 'w-full'
        },
        {
          id: 'bmfont-gen',
          name: t('tool.bmfont_gen.name'),
          description: t('tool.bmfont_gen.desc'),
          icon: Type,
          component: <BitmapFontGenerator />,
          layoutClass: 'w-full'
        },
        {
          id: 'code-runner',
          name: t('tool.code_runner.name'),
          description: t('tool.code_runner.desc'),
          icon: Terminal,
          component: <CodeRunner />,
          layoutClass: 'w-full'
        },
        {
          id: 'easing-vis',
          name: t('tool.easing_vis.name'),
          description: t('tool.easing_vis.desc'),
          icon: Activity,
          component: <EasingVisualizer />,
          layoutClass: 'max-w-7xl mx-auto'
        }
      ]
    },
    {
      id: CategoryId.NETWORK,
      name: t('cat.network'),
      icon: Network,
      description: t('cat.network.desc'),
      tools: [
        {
          id: 'check-host',
          name: t('tool.check_host.name'),
          description: t('tool.check_host.desc'),
          icon: Globe,
          component: <CheckHost />,
          layoutClass: 'w-full'
        },
        {
          id: 'speed-test',
          name: t('tool.speed_test.name'),
          description: t('tool.speed_test.desc'),
          icon: Gauge,
          component: <SpeedTest />,
          layoutClass: 'w-full'
        }
      ]
    }
  ], [t]);

  return categories;
};
