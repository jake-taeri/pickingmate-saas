import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function BarcodeImage({ value, height = 48, width = 2 }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width,
        height,
        displayValue: false,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (e) {
      console.warn('Barcode generation failed:', e);
    }
  }, [value, height, width]);

  return <svg ref={ref} />;
}
