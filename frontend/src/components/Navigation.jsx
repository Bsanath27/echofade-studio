import { Stepper, Step, StepLabel, Box, Typography } from '@mui/material'

export default function Navigation({ currentStep, setStep, completedSteps }) {
  const steps = [
    { num: 1, label: 'Import', sublabel: 'Audio & visual source' },
    { num: 2, label: 'Master Audio', sublabel: 'Effects, EQ, spatial' },
    { num: 3, label: 'Lyrics', sublabel: 'Search & sync' },
    { num: 4, label: 'Export', sublabel: 'Render & download' }
  ]

  return (
    <Box sx={{ mt: 2 }}>
      <Stepper activeStep={currentStep - 1} orientation="vertical">
        {steps.map((s, index) => {
          const isCompleted = completedSteps.includes(s.num)
          const isActive = currentStep === s.num
          const canClick = isCompleted || s.num <= Math.max(...completedSteps, 0) + 1

          return (
            <Step key={s.num} completed={isCompleted}>
              <StepLabel 
                onClick={() => canClick && setStep(s.num)}
                sx={{ 
                  cursor: canClick ? 'pointer' : 'default',
                  '& .MuiStepLabel-label': {
                    color: isActive ? 'text.primary' : 'text.secondary',
                    fontWeight: isActive ? 'bold' : 'normal',
                  }
                }}
              >
                <Typography variant="body1">{s.label}</Typography>
                <Typography variant="caption" color="text.secondary">{s.sublabel}</Typography>
              </StepLabel>
            </Step>
          )
        })}
      </Stepper>
    </Box>
  )
}
