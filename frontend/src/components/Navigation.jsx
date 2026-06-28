export default function Navigation({ currentStep, setStep, completedSteps }) {
  const steps = [
    { num: 1, label: 'Import', sublabel: 'Audio & visual source' },
    { num: 2, label: 'Master Audio', sublabel: 'Effects, EQ, spatial' },
    { num: 3, label: 'Lyrics', sublabel: 'Search & sync' },
    { num: 4, label: 'Export', sublabel: 'Render & download' }
  ]

  return (
    <nav className="step-indicator">
      {steps.map((s, i) => {
        const isCompleted = completedSteps.includes(s.num)
        const isActive = currentStep === s.num
        const canClick = isCompleted || s.num <= Math.max(...completedSteps, 0) + 1

        return (
          <div 
            key={s.num}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${canClick ? 'clickable' : ''}`}
            onClick={() => canClick && setStep(s.num)}
          >
            <div className="step-dot-col">
              <div className="step-dot">
                {isCompleted ? '✓' : s.num}
              </div>
              {i < steps.length - 1 && <div className="step-line"></div>}
            </div>
            <div className="step-info">
              <div className="step-label">{s.label}</div>
              <div className="step-sublabel">{s.sublabel}</div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
