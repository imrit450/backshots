import QRCode from 'qrcode';
import { config } from '../config';

export async function generateQRCodeDataUrl(eventCode: string): Promise<string> {
  const url = `${config.frontendUrl}/e/${eventCode}`;
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

export function getEventUrl(eventCode: string): string {
  return `${config.frontendUrl}/e/${eventCode}`;
}
