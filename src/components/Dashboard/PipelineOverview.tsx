interface StepInfo {
  step_order: number;
  subject: string;
  contacts_at_step: number;
  opened: number;
  replied: number;
}

interface SequenceInfo {
  id: number;
  name: string;
  steps: StepInfo[];
  totalContacts: number;
}

interface Props {
  sequences: SequenceInfo[];
}

export default function PipelineOverview({ sequences }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Sequence Pipeline Overview</h3>
      {sequences.length === 0 ? (
        <div className="text-gray-600 text-center py-8">No sequences yet. Create one or import contacts to auto-generate.</div>
      ) : (
        <div className="space-y-6">
          {sequences.map((seq) => (
            <div key={seq.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">{seq.name}</h4>
                <span className="text-sm text-gray-700">{seq.totalContacts} contacts</span>
              </div>
              {seq.steps.length === 0 ? (
                <p className="text-sm text-gray-600">No steps configured</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {seq.steps.map((step) => (
                    <div key={step.step_order} className="flex-shrink-0 bg-gray-50 rounded-lg p-3 min-w-[140px] border border-gray-100">
                      <p className="text-xs text-gray-700 mb-1">Step {step.step_order}</p>
                      <p className="text-sm font-medium text-gray-800 truncate" title={step.subject}>{step.subject}</p>
                      <div className="mt-2 flex gap-2 text-xs">
                        <span className="text-blue-600">{step.contacts_at_step} queued</span>
                        <span className="text-green-600">{step.opened} opened</span>
                        <span className="text-purple-600">{step.replied} replied</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
