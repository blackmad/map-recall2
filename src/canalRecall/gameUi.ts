// The browser adapter's single entry point for HUD geometry and theming.
//
// Bundled to `js/game-ui.bundle.js` as `CanalRecallUi`, so the legacy canvas
// runtime asks one global where a card goes and what colour it is, instead of
// carrying a second copy of those numbers.
export * from './viewport.ts';
export * from './touchControls.ts';
export * from './hudLayout.ts';
export * from './hudTheme.ts';
export * from './hudCopy.ts';
export { openOnboarding, maybeShowOnboarding, isOnboardingOpen } from './onboarding/dom.ts';
export { ONBOARDING_STORAGE_KEY, onboardingSteps } from './onboarding/steps.ts';
export * from './streetFollow.ts';
export * from './cameraYaw.ts';
export {
  advance as advanceSteer, step as stepSteer, initialSteerState, bikeLean, bicycleYawLimit,
  BIKE as BIKE_STEER, LEGACY_BASE as LEGACY_STEER, STEP_MAX as STEER_STEP_MAX,
} from './drive/steerModel.ts';
export { initialCameraFollow, stepCameraFollow, pullBackZoomScale } from './drive/cameraFollow.ts';
