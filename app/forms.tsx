"use client";

import {
  startTransition,
  useActionState,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { FormState } from "./form-state";

// A labelled input.
export function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
    </div>
  );
}

// A labelled dropdown of fixed options.
export function SelectField({
  id,
  label,
  name,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect id={id} name={name} defaultValue={defaultValue} className="w-full">
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
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
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <div>
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.message && (
        <Alert variant="success" role="status">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

// Country and city dropdowns. The cities offered follow the chosen country.
// Country names come from the server in the player's language.
export function LocationSelect({
  idPrefix,
  countries,
  defaultCountry = "",
  defaultCity = "",
}: {
  idPrefix: string;
  countries: { code: string; name: string; cities: readonly string[] }[];
  defaultCountry?: string;
  defaultCity?: string;
}) {
  const t = useTranslations("fields");
  const [country, setCountry] = useState(defaultCountry);
  const cities = countries.find((c) => c.code === country)?.cities ?? [];

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-country`}>{t("country")}</Label>
        <NativeSelect
          id={`${idPrefix}-country`}
          name="country"
          required
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="w-full"
        >
          <NativeSelectOption value="">{t("chooseCountry")}</NativeSelectOption>
          {countries.map((c) => (
            <NativeSelectOption key={c.code} value={c.code}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-city`}>{t("city")}</Label>
        <NativeSelect
          // A new country starts the city choice afresh.
          key={country}
          id={`${idPrefix}-city`}
          name="city"
          required
          disabled={cities.length === 0}
          defaultValue={country === defaultCountry ? defaultCity : ""}
          className="w-full"
        >
          <NativeSelectOption value="">{t("chooseCity")}</NativeSelectOption>
          {cities.map((city) => (
            <NativeSelectOption key={city} value={city}>
              {city}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
