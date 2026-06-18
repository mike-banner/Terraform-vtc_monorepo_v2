export interface TunnelConfig {
  maxSteps?: number;
  onStepChange?: (stepIndex: number) => void;
  /**
   * Return true to proceed to next step, false to block.
   */
  onValidateStep?: (stepIndex: number, formData: FormData) => boolean | Promise<boolean>;
  /**
   * Called on the final step submission.
   */
  onSubmit?: (formData: FormData) => void | Promise<void>;
}

export class TunnelManager {
  currentStep: number;
  maxSteps: number;
  form: HTMLFormElement | null;
  steps: NodeListOf<Element>;
  submitBtn: HTMLButtonElement | null;
  backBtn: HTMLElement | null;

  config: TunnelConfig;

  constructor(formId: string, config: TunnelConfig = {}) {
    this.form = document.getElementById(formId) as HTMLFormElement;
    this.maxSteps = config.maxSteps || 4;
    this.currentStep = 1;
    this.config = config;

    this.steps = document.querySelectorAll('.step-container');
    this.submitBtn = document.querySelector(`button[form="${formId}"]`) as HTMLButtonElement;
    this.backBtn = document.getElementById('back-btn');

    this.init();
  }

  init() {
    if (!this.form) return;

    if (this.backBtn) {
      this.backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.currentStep > 1) {
          this.currentStep--;
          this.showStep(this.currentStep);
        }
      });
    }

    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(this.form!);

      if (this.currentStep < this.maxSteps) {
        let isValid = true;
        if (this.config.onValidateStep) {
          isValid = await this.config.onValidateStep(this.currentStep, formData);
        }

        if (isValid) {
          this.currentStep++;
          this.showStep(this.currentStep);
        }
      } else {
        // Final step validation
        let isValid = true;
        if (this.config.onValidateStep) {
          isValid = await this.config.onValidateStep(this.currentStep, formData);
        }

        if (isValid && this.config.onSubmit) {
          await this.config.onSubmit(formData);
        }
      }
    });

    this.showStep(1);
  }

  showStep(stepIndex: number) {
    // Affichage des étapes
    this.steps.forEach((el, idx) => {
      if (idx + 1 === stepIndex) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Mise à jour de la barre de progression
    const progressBar = document.getElementById('progress-bar-line');
    if (progressBar) {
      progressBar.style.width = `${((stepIndex - 1) / (this.maxSteps - 1)) * 100}%`;
    }

    const circles = document.querySelectorAll('.progress-step-circle');
    circles.forEach(circle => {
      const stepNum = parseInt(circle.getAttribute('data-step') || '1', 10);
      circle.className = `progress-step-circle w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
        stepNum < stepIndex ? 'bg-black text-white' : stepNum === stepIndex ? 'bg-black text-white ring-4 ring-black/5' : 'bg-zinc-200 text-zinc-500'
      }`;
    });

    const labels = document.querySelectorAll('.progress-step-label');
    labels.forEach(label => {
      const stepNum = parseInt(label.getAttribute('data-step') || '1', 10);
      label.className = `progress-step-label mt-2 text-xs font-medium text-center transition-colors duration-300 ${
        stepNum <= stepIndex ? 'text-zinc-900' : 'text-zinc-500'
      }`;
    });

    const submitBtnText = document.getElementById('submit-btn-text');
    if (submitBtnText) {
      // Pour être sûr que ça marche dans tous les tunnels (Business a "Finaliser la demande", Transfert a "Finaliser")
      // On va juste mettre "Finaliser" pour tous
      submitBtnText.textContent = stepIndex === this.maxSteps ? 'Finaliser' : 'Continuer';
    }

    const progressText = document.getElementById('current-step-text');
    if (progressText) {
      progressText.textContent = stepIndex.toString();
    }

    if (this.backBtn) {
      if (stepIndex > 1) {
        this.backBtn.classList.remove('hidden');
      } else {
        this.backBtn.classList.add('hidden');
      }
    }

    if (this.config.onStepChange) {
      this.config.onStepChange(stepIndex);
    }
  }

  setLoading(isLoading: boolean, loadingText: string = 'Chargement...') {
    if (!this.submitBtn) return;
    if (isLoading) {
      this.submitBtn.dataset.originalText = this.submitBtn.textContent || '';
      this.submitBtn.textContent = loadingText;
      this.submitBtn.disabled = true;
    } else {
      this.submitBtn.textContent = this.submitBtn.dataset.originalText || 'Continuer';
      this.submitBtn.disabled = false;
    }
  }
}
