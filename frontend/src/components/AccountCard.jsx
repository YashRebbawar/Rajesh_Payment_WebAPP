export default function AccountCard({ data, selected, onSelect }) {
  return (
    <div
      className={`account-card ${selected === data.id ? "selected" : ""} ${data.popular ? "popular" : ""}`}
      onClick={() => onSelect(data.id)}
    >
      {data.popular && <div className="popular-badge">Recommended</div>}
      {data.badge && <div className="best-badge">{data.badge}</div>}
      <div className="card-header">
        <h2>{data.title}</h2>
        <span className="subtitle">{data.subtitle}</span>
      </div>
      <p className="description">{data.description}</p>
      <div className="card-details">
        <div className="detail-row">
          <span className="label">Minimum deposit</span>
          <span className="value">{data.minDeposit}</span>
        </div>
        <div className="detail-row">
          <span className="label">Spread</span>
          <span className="value">{data.spread}</span>
        </div>
        <div className="detail-row">
          <span className="label">Commission</span>
          <span className="value">{data.commission}</span>
        </div>
      </div>
    </div>
  );
}