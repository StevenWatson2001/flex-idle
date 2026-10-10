"use client";

import {
  startTransition,
  useActionState,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { COUNTRIES, findCountry } from "@/lib/accounts/locations";
import type { FormState } from "./form-state";

// A labelled input.
export function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <p>
      <label htmlFor={id}>{label}</label> <input id={id} {...input} />
    </p>
  );
}

// A form that sends its fields to a server action and shows the error or
// message it returns. Submitting this way, rather than with <form action>,
// stops React clearing the fields, so a typo can be fixed and resent.
export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
      {state?.error && <p role="alert">{state.error}</p>}
      {state?.message && <p role="status">{state.message}</p>}
    </form>
  );
}

// Country and city dropdowns. The cities offered follow the chosen country.
export function LocationSelect({
  idPrefix,
  defaultCountry = "",
  defaultCity = "",
}: {
  idPrefix: string;
  defaultCountry?: string;
  defaultCity?: string;
}) {
  const [country, setCountry] = useState(defaultCountry);
  const cities = findCountry(country)?.cities ?? [];

  return (
    <>
      <p>
        <label htmlFor={`${idPrefix}-country`}>Country</label>{" "}
        <select
          id={`${idPrefix}-country`}
          name="country"
          required
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          <option value="">Choose a country</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </p>
      <p>
        <label htmlFor={`${idPrefix}-city`}>City</label>{" "}
        <select
          // A new country starts the city choice afresh.
          key={country}
          id={`${idPrefix}-city`}
          name="city"
          required
          disabled={cities.length === 0}
          defaultValue={country === defaultCountry ? defaultCity : ""}
        >
          <option value="">Choose a city</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </p>
    </>
  );
}
