import { createMachine } from "xstate";

export type ReportingEvent =
  | { type: "START" }
  | { type: "LOCATION_ACQUIRED"; coords: { lat: number; lng: number } }
  | { type: "LOCATION_FAILED" }
  | { type: "SUBMIT"; data: unknown }
  | { type: "SUBMIT_SUCCESS" }
  | { type: "SUBMIT_OFFLINE" }
  | { type: "SUBMIT_ERROR"; error: string }
  | { type: "RESET" };

export interface ReportingContext {
  coords: { lat: number; lng: number } | null;
  formData: unknown;
  errorMessage: string | null;
}

export const reportingMachine = createMachine({
  id: "reporting",
  types: {} as {
    events: ReportingEvent;
    context: ReportingContext;
  },
  context: {
    coords: null,
    formData: null,
    errorMessage: null,
  },
  initial: "idle",
  states: {
    idle: {
      on: {
        START: "acquiringLocation",
      },
    },
    acquiringLocation: {
      on: {
        LOCATION_ACQUIRED: {
          target: "fillingDetails",
          actions: ({ context, event }) => {
            context.coords = event.coords;
          },
        },
        LOCATION_FAILED: {
          target: "fillingDetails",
          actions: ({ context }) => {
            context.coords = null; // Fallback to manual selection
          },
        },
      },
    },
    fillingDetails: {
      on: {
        SUBMIT: {
          target: "submitting",
          actions: ({ context, event }) => {
            context.formData = event.data;
          },
        },
        RESET: "idle",
      },
    },
    submitting: {
      on: {
        SUBMIT_SUCCESS: "success",
        SUBMIT_OFFLINE: "offlineQueue",
        SUBMIT_ERROR: {
          target: "fillingDetails",
          actions: ({ context, event }) => {
            context.errorMessage = event.error;
          },
        },
      },
    },
    success: {
      on: {
        RESET: {
          target: "idle",
          actions: ({ context }) => {
            context.coords = null;
            context.formData = null;
            context.errorMessage = null;
          },
        },
      },
    },
    offlineQueue: {
      on: {
        RESET: {
          target: "idle",
          actions: ({ context }) => {
            context.coords = null;
            context.formData = null;
            context.errorMessage = null;
          },
        },
      },
    },
  },
});
