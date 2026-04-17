export default function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap no-print">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type !== 'default' ? t.type : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
