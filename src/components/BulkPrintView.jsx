import PrintView from './PrintView.jsx';

/**
 * 여러 주문을 한 번에 출력하는 뷰
 * printData: [{ order, zoneGroups }, ...]
 */
export default function BulkPrintView({ printData }) {
  if (!printData || printData.length === 0) return null;

  return (
    <div className="print-only">
      {printData.map(({ order, zoneGroups }, idx) => (
        <div
          key={order.order_id}
          style={idx < printData.length - 1 ? { pageBreakAfter: 'always' } : {}}
        >
          <PrintView order={order} zoneGroups={zoneGroups} noWrapper />
        </div>
      ))}
    </div>
  );
}
