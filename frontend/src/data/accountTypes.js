export const accountTypes = [
  { 
    id: "standard", 
    title: "Standard", 
    subtitle: "Recommended", 
    description: "Most popular! A great account for all types of traders", 
    minDeposit: "10 USD", 
    spread: "From 0.20", 
    commission: "No commission",
    popular: true
  },
  { 
    id: "pro", 
    title: "Pro", 
    subtitle: "Instant or market execution", 
    description: "Zero commission and low spreads with both instant or market execution.", 
    minDeposit: "500 USD", 
    spread: "From 0.10", 
    commission: "No commission",
    popular: false
  },
  { 
    id: "raw-spread", 
    title: "Raw spread", 
    subtitle: "Professional", 
    description: "Low raw spreads and a low fixed commission", 
    minDeposit: "500 USD", 
    spread: "From 0.00", 
    commission: "To 3.50 USD",
    popular: false
  },
  { 
    id: "zero", 
    title: "Zero", 
    subtitle: "Professional", 
    description: "Get 0 spreads for 95% of the day on 30 pairs", 
    minDeposit: "500 USD", 
    spread: "Best", 
    commission: "From 0.20 USD",
    popular: false,
    badge: "Best"
  }
];