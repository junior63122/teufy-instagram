import {Config} from '@remotion/cli/config';
// Rendu : images JPEG haute qualité, H.264 lisible partout (Instagram compris).
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
Config.setCrf(18);
Config.setPixelFormat('yuv420p');
Config.setConcurrency(4);
