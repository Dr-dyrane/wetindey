# NBS May 2026 controlled pilot

This pilot is a deterministic review artifact, not a database import and not publication.
The source package remains external because source permission is unresolved. Only its
official pointer, package metadata, supplied SHA-256, and two page-specific facts are
retained in Git.

The external fetch succeeded and is recorded as `outcome: captured` with
`captureStatus: retained_external`, but those are evidence facts, not staging permission.
The artifact is not a `public_source_captures` or `public_ingestion_fetches` row. Its
proposed/discovery-only source policy makes it ineligible for database staging.

## Evidence boundary

- Official package: <https://microdata.nigerianstat.gov.ng/index.php/catalog/162/download/1427>
- Package SHA-256: `2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466`
- Package files: `Selected_Food_Report_May 26.pdf` and
  `selected food table May 26.xlsx`
- The XLSX has national and zonal data only. It is not evidence for Lagos State candidate
  rows.
- PDF page 3 summarizes the Lagos result and page 16 preserves the source row label
  `Tomatoes, fresh` for the 1kg May 2026 average of NGN 1,974.81.
- PDF page 16 supports Lagos State as the state lowest for Semovita Prepacked 1kg at
  NGN 1,777.15.

Both candidates preserve the source place label `Lagos` while retaining
`geographicPrecision: lagos_state`. They retain `observedAt: null`, the raw period
`May 2026`, publication date
2026-06-25, `availability: unknown`, and `geographicPrecision: lagos_state`. They claim no
market, LGA, neighbourhood, shop, or seller specificity. Canonical item, variant, and unit
UUIDs are absent, so validation fails closed at `needs_item_mapping`. The UTC survey start
and end are deterministic month-boundary normalization conventions, not source timestamps.
The source publication value is preserved as raw date `2026-06-25`; UTC midnight is only
the deterministic normalization convention for that date, not a claimed source timestamp.
Raw prices preserve the source's naira sign (`₦1,974.81` and `₦1,777.15`) separately from
normalized `NGN` and integer kobo values.

Run the read-only validator with:

```sh
npx tsx scripts/ingestion/validate-review-artifact.ts
```

The validator imports all six Drizzle staging tables, checks the publication firewall,
recomputes candidate validation and fingerprints, and performs no network or database
operation.

For refutation against a locally retained package, supply its path explicitly:

```sh
npx tsx scripts/ingestion/validate-review-artifact.ts --package /absolute/path/to/package.zip
```

That optional mode hashes the actual bytes, checks byte length, and reads ZIP central
directory filenames without extracting or modifying the package.
