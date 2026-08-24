// src/components/technician/RecurringScheduleWizardWithContract.tsx
// RecurringScheduleWizard som själv hämtar besöksfrekvensen ur kundens avtal.
//
// Wizarden visar då "Enligt avtalet: N besök per år" och förväljer rätt
// intervall, så den som lägger schemat ser vad kunden faktiskt betalat för
// utan att behöva slå upp avtalet separat.

import { RecurringScheduleWizard } from './RecurringScheduleWizard'
import { useContractVisitFrequency } from '../../hooks/useContractVisitFrequency'

type WizardProps = React.ComponentProps<typeof RecurringScheduleWizard>

export function RecurringScheduleWizardWithContract(props: WizardProps) {
  const { frequency, visitsPerYear, contractId } = useContractVisitFrequency(props.isOpen ? props.customerId : null)
  return (
    <RecurringScheduleWizard
      {...props}
      contractVisitFrequency={props.contractVisitFrequency ?? frequency}
      contractVisitsPerYear={props.contractVisitsPerYear ?? visitsPerYear}
      resolvedContractId={props.resolvedContractId ?? contractId}
    />
  )
}
