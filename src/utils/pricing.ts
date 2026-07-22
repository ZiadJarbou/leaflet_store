interface DiscountablePlan {
  monthlyPrice?: number;
  yearlyPrice?: number;
}

export function getMaximumAnnualSavings(plans: DiscountablePlan[]): number {
  return plans.reduce((maximum, plan) => {
    const monthly = Number(plan.monthlyPrice) || 0;
    const annualMonthlyEquivalent = Number(plan.yearlyPrice) || 0;
    if (monthly <= 0 || annualMonthlyEquivalent < 0 || annualMonthlyEquivalent >= monthly) {
      return maximum;
    }
    const percentage = Math.round(((monthly - annualMonthlyEquivalent) / monthly) * 100);
    return Math.max(maximum, percentage);
  }, 0);
}
