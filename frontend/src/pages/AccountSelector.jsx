import AccountCard from "../components/AccountCard";
import { useState } from "react";
import { accountTypes } from "../data/accountTypes";

export default function AccountSelector() {
  const [selected, setSelected] = useState(null);

  return (
    <div className="account-container">
      <h1 className="account-title">Open New Account</h1>
      <div className="account-grid">
        {accountTypes.map((acc) => (
          <AccountCard key={acc.id} data={acc} selected={selected} onSelect={setSelected} />
        ))}
      </div>
      {selected && (
        <button className="open-button">
          Open {accountTypes.find((a) => a.id === selected)?.title} Account
        </button>
      )}
    </div>
  );
}