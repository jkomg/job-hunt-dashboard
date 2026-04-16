# Scripts

One-off utility scripts for the Job Hunt Dashboard. These are not part of the app — run them locally as needed.

## import-legacy-jobs.js

Bulk-imports a legacy Notion page of job applications into the pipeline database.

### What it does

- Reads a Notion page that contains a numbered list of job applications
- Parses each entry for: company, role, job URL, date applied, and outcome
- Strikethrough text → `Ghosted`; entries containing "rejected" → `Rejected — No Interview`
- Creates a `❌ Closed` pipeline card for each entry

### Setup

```bash
cp .env.example .env   # ensure NOTION_TOKEN and NOTION_PIPELINE_DB are set
```

### Running

```bash
node scripts/import-legacy-jobs.js
```

Safe to inspect before running — it only creates records, never deletes.

### Adapting for your own list

1. Change `SOURCE_PAGE_ID` at the top of the script to your Notion page ID
   - Find it in the page URL: `notion.so/Your-Page-Title-{PAGE_ID}`
2. The parser expects a **numbered list** where each item is roughly:
   `Company — Role — URL — Date (M/D)`
3. Strikethrough items are treated as closed. Adjust the `outcome` logic in `parseEntry()` if your list uses different conventions.
4. Date inference assumes `month >= 10` = prior year, `month < 10` = current year. Update `parseDate()` if your list spans different years.

### Limitations

- Role extraction is best-effort on free-form text — some entries may need manual cleanup after import
- Does not deduplicate: running twice will create duplicate entries
- Only processes top-level numbered list items (not sub-pages or nested lists)
