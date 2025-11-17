export const accountTypes = [
  { 
    id: "standard", 
    title: "Standard", 
    subtitle: "Recommended", 
    description: "Most popular. A great account for all types of traders.", 
    minDeposit: "$10", 
    spread: "From 1.0 pips", 
    commission: "No commission",
    leverage: "1:2000",
    popular: true
  },
  { 
    id: "pro", 
    title: "Pro", 
    subtitle: "Best execution", 
    description: "Zero commission and low spreads for experienced traders.", 
    minDeposit: "$2,000", 
    spread: "From 0.0 pips", 
    commission: "From $3.5",
    leverage: "1:2000",
    popular: false
  },
  { 
    id: "zero", 
    title: "Zero", 
    subtitle: "Zero spreads", 
    description: "Zero spreads on major currency pairs.", 
    minDeposit: "$500", 
    spread: "From 0.0 pips", 
    commission: "From $3.5",
    leverage: "1:2000",
    popular: false
  },
  { 
    id: "raw", 
    title: "Raw Spread", 
    subtitle: "Institutional", 
    description: "Raw spreads straight from liquidity providers.", 
    minDeposit: "$200", 
    spread: "From 0.0 pips", 
    commission: "From $3.5",
    leverage: "1:2000",
    popular: false
  }
];