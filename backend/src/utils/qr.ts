import QRCode from 'qrcode';
import { config } from '../config';

function resolveFrontendOrigin(explicitOrigin?: string): string {
  if (explicitOrigin) return explicitOrigin;
  return config.frontendUrl;
}

export async function generateQRCodeDataUrl(eventCode: string, origin?: string): Promise<string> {
  const base = resolveFrontendOrigin(origin);
  const url = `${base}/e/${eventCode}`;
  return QRCode.toDataURL(url, {
    width: 400,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

export function getEventUrl(eventCode: string, origin?: string): string {
  const base = resolveFrontendOrigin(origin);
  return `${base}/e/${eventCode}`;
}
