-- ============================================================
-- 016: Clinical Note System
-- All tables below were referenced in code but had no migration.
-- Uses IF NOT EXISTS throughout — safe to run even if tables
-- were already created ad-hoc in Supabase.
-- ============================================================

-- ── 1. clinical_notes ───────────────────────────────────────
create table if not exists clinical_notes (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references bookings(id) on delete cascade,
  patient_id       uuid not null references users(id),
  provider_id      uuid not null references providers(id),
  status           text not null default 'draft'
                     check (status in ('draft', 'submitted')),
  people_in_attendance  jsonb,
  presenting_complaints jsonb,
  chronic_issues        jsonb,
  history               jsonb,
  social_history        jsonb,
  general_examination   jsonb,
  systemic_examinations jsonb,
  interventions         jsonb,
  recommendations       jsonb,
  follow_up_date        date,
  safeguarding_flag     boolean not null default false,
  submitted_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists clinical_notes_booking_id_idx
  on clinical_notes(booking_id);

alter table clinical_notes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clinical_notes' and policyname = 'providers_own_notes'
  ) then
    create policy providers_own_notes on clinical_notes
      for all using (
        provider_id in (select id from providers where user_id = auth.uid())
        or get_user_role() = 'admin'
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clinical_notes' and policyname = 'patients_read_own_notes'
  ) then
    create policy patients_read_own_notes on clinical_notes
      for select using (patient_id = auth.uid());
  end if;
end $$;


-- ── 2. vitals ───────────────────────────────────────────────
create table if not exists vitals (
  id                uuid primary key default gen_random_uuid(),
  clinical_note_id  uuid not null references clinical_notes(id) on delete cascade,
  bp_systolic       integer,
  bp_diastolic      integer,
  pulse_rate        integer,
  pulse_rhythm      text,
  temperature       numeric(5,1),
  temp_unit         text not null default 'C' check (temp_unit in ('C', 'F')),
  spo2              integer,
  respiratory_rate  integer,
  weight            numeric(6,2),
  height            numeric(6,2),
  created_at        timestamptz not null default now()
);

alter table vitals enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'vitals' and policyname = 'vitals_access'
  ) then
    create policy vitals_access on vitals
      for all using (
        clinical_note_id in (
          select id from clinical_notes
          where provider_id in (select id from providers where user_id = auth.uid())
             or patient_id = auth.uid()
             or get_user_role() = 'admin'
        )
      );
  end if;
end $$;


-- ── 3. clinical_note_diagnoses ───────────────────────────────
create table if not exists clinical_note_diagnoses (
  id                        uuid primary key default gen_random_uuid(),
  clinical_note_id          uuid not null references clinical_notes(id) on delete cascade,
  provider_id               uuid references providers(id),
  patient_id                uuid references users(id),
  source                    text,
  icd10_code                text,
  clinical_description      text,
  plain_language_diagnosis  text,
  diagnosis_type            text not null default 'primary'
                              check (diagnosis_type in ('primary', 'secondary', 'comorbidity')),
  is_uncodified             boolean not null default false,
  created_at                timestamptz not null default now()
);

create index if not exists cnd_clinical_note_id_idx
  on clinical_note_diagnoses(clinical_note_id);

create index if not exists cnd_patient_id_idx
  on clinical_note_diagnoses(patient_id);

alter table clinical_note_diagnoses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'clinical_note_diagnoses' and policyname = 'diagnoses_access'
  ) then
    create policy diagnoses_access on clinical_note_diagnoses
      for all using (
        provider_id in (select id from providers where user_id = auth.uid())
        or get_user_role() = 'admin'
      );
  end if;
end $$;


-- ── 4. visit_summaries ───────────────────────────────────────
create table if not exists visit_summaries (
  id                uuid primary key default gen_random_uuid(),
  clinical_note_id  uuid not null references clinical_notes(id) on delete cascade,
  patient_id        uuid not null references users(id),
  visit_date        date,
  provider_name     text,
  reason_for_visit  text,
  plain_diagnosis   text,
  abnormal_vitals   jsonb,
  what_was_done     text,
  medications       jsonb,
  investigations    jsonb,
  recommendations   text,
  follow_up_date    date,
  visible_to_patient boolean not null default true,
  created_at        timestamptz not null default now()
);

create unique index if not exists visit_summaries_note_id_idx
  on visit_summaries(clinical_note_id);

create index if not exists visit_summaries_patient_id_idx
  on visit_summaries(patient_id);

alter table visit_summaries enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'visit_summaries' and policyname = 'patients_read_summaries'
  ) then
    create policy patients_read_summaries on visit_summaries
      for select using (
        patient_id = auth.uid()
        and visible_to_patient = true
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'visit_summaries' and policyname = 'admin_all_summaries'
  ) then
    create policy admin_all_summaries on visit_summaries
      for all using (get_user_role() = 'admin');
  end if;
end $$;


-- ── 5. notifications_queue ───────────────────────────────────
create table if not exists notifications_queue (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references users(id),
  message     text not null,
  send_at     timestamptz not null,
  type        text not null default 'general',
  sent        boolean not null default false,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_queue_send_at_idx
  on notifications_queue(send_at) where sent = false;

alter table notifications_queue enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'notifications_queue' and policyname = 'admin_only_notifications'
  ) then
    create policy admin_only_notifications on notifications_queue
      for all using (get_user_role() = 'admin');
  end if;
end $$;


-- ── 6. safeguarding_alerts ───────────────────────────────────
create table if not exists safeguarding_alerts (
  id                uuid primary key default gen_random_uuid(),
  clinical_note_id  uuid not null references clinical_notes(id) on delete cascade,
  patient_id        uuid not null references users(id),
  provider_id       uuid not null references providers(id),
  resolved          boolean not null default false,
  resolved_by       uuid references users(id),
  resolved_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now()
);

alter table safeguarding_alerts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'safeguarding_alerts' and policyname = 'admin_only_safeguarding'
  ) then
    create policy admin_only_safeguarding on safeguarding_alerts
      for all using (get_user_role() = 'admin');
  end if;
end $$;


-- ── 7. streetdocmd_diagnoses (curated catalogue) ─────────────
create table if not exists streetdocmd_diagnoses (
  id                    uuid primary key default gen_random_uuid(),
  icd10_code            text,
  clinical_description  text not null,
  plain_language        text not null,
  category              text not null default 'general'
                          check (category in (
                            'infectious','respiratory','cardiovascular','endocrine',
                            'neurological','gastrointestinal','musculoskeletal',
                            'dermatological','gynaecological','mental_health',
                            'geriatric','general'
                          )),
  is_curated            boolean not null default true,
  active                boolean not null default true,
  usage_count           integer not null default 0,
  created_at            timestamptz not null default now()
);

alter table streetdocmd_diagnoses enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'streetdocmd_diagnoses' and policyname = 'providers_read_catalogue'
  ) then
    create policy providers_read_catalogue on streetdocmd_diagnoses
      for select using (active = true and auth.role() = 'authenticated');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'streetdocmd_diagnoses' and policyname = 'admin_manage_catalogue'
  ) then
    create policy admin_manage_catalogue on streetdocmd_diagnoses
      for all using (get_user_role() = 'admin');
  end if;
end $$;

-- Seed curated catalogue with common Nigerian home-healthcare diagnoses
insert into streetdocmd_diagnoses (icd10_code, clinical_description, plain_language, category) values
  ('B54',   'Unspecified malaria',                                     'Malaria',                      'infectious'),
  ('B50.9', 'Plasmodium falciparum malaria, uncomplicated',            'Falciparum Malaria',           'infectious'),
  ('A01.0', 'Typhoid fever due to Salmonella typhi',                   'Typhoid Fever',                'infectious'),
  ('A09',   'Other and unspecified gastroenteritis and colitis',       'Gastroenteritis / Stooling',   'infectious'),
  ('A06.0', 'Acute amoebiasis',                                        'Amoebic Dysentery',            'infectious'),
  ('B17.9', 'Acute viral hepatitis, unspecified',                      'Hepatitis',                    'infectious'),
  ('B20',   'Human immunodeficiency virus disease',                    'HIV',                          'infectious'),
  ('A15.0', 'Pulmonary tuberculosis',                                  'Tuberculosis (TB)',             'infectious'),
  ('J00',   'Acute nasopharyngitis',                                   'Common Cold',                  'respiratory'),
  ('J06.9', 'Acute upper respiratory infection, unspecified',          'Upper Respiratory Tract Infection (URTI)', 'respiratory'),
  ('J03.9', 'Acute tonsillitis, unspecified',                          'Tonsillitis / Sore Throat',    'respiratory'),
  ('J18.9', 'Pneumonia, unspecified organism',                         'Pneumonia',                    'respiratory'),
  ('J45.9', 'Asthma, uncomplicated',                                   'Asthma',                       'respiratory'),
  ('J20.9', 'Acute bronchitis, unspecified',                           'Bronchitis',                   'respiratory'),
  ('I10',   'Essential (primary) hypertension',                        'Hypertension (High Blood Pressure)', 'cardiovascular'),
  ('I25.1', 'Atherosclerotic heart disease of native coronary artery', 'Heart Disease',                'cardiovascular'),
  ('I50.9', 'Heart failure, unspecified',                              'Heart Failure',                'cardiovascular'),
  ('E11.9', 'Type 2 diabetes mellitus without complications',          'Type 2 Diabetes',              'endocrine'),
  ('E10.9', 'Type 1 diabetes mellitus without complications',          'Type 1 Diabetes',              'endocrine'),
  ('E03.9', 'Hypothyroidism, unspecified',                             'Underactive Thyroid',          'endocrine'),
  ('E78.5', 'Hyperlipidemia, unspecified',                             'High Cholesterol',             'endocrine'),
  ('G43.9', 'Migraine, unspecified',                                   'Migraine',                     'neurological'),
  ('R51',   'Headache',                                                'Headache',                     'neurological'),
  ('G40.9', 'Epilepsy, unspecified',                                   'Epilepsy / Seizures',          'neurological'),
  ('G35',   'Multiple sclerosis',                                      'Multiple Sclerosis',           'neurological'),
  ('K21.0', 'Gastro-oesophageal reflux disease with oesophagitis',    'Acid Reflux / GERD',           'gastrointestinal'),
  ('K29.7', 'Gastritis, unspecified',                                  'Stomach Inflammation (Gastritis)', 'gastrointestinal'),
  ('K59.0', 'Constipation',                                            'Constipation',                 'gastrointestinal'),
  ('K59.1', 'Functional diarrhoea',                                    'Diarrhoea',                    'gastrointestinal'),
  ('K80.2', 'Calculus of gallbladder without cholecystitis',           'Gallstones',                   'gastrointestinal'),
  ('M54.5', 'Low back pain',                                           'Low Back Pain',                'musculoskeletal'),
  ('M79.3', 'Panniculitis',                                            'Joint Pain',                   'musculoskeletal'),
  ('M06.9', 'Rheumatoid arthritis, unspecified',                       'Rheumatoid Arthritis',         'musculoskeletal'),
  ('L50.9', 'Urticaria, unspecified',                                  'Hives / Urticaria',            'dermatological'),
  ('L30.9', 'Dermatitis, unspecified',                                 'Skin Rash / Dermatitis',       'dermatological'),
  ('L40.0', 'Psoriasis vulgaris',                                      'Psoriasis',                    'dermatological'),
  ('B35.1', 'Tinea unguium',                                           'Ringworm / Fungal Skin Infection', 'dermatological'),
  ('N39.0', 'Urinary tract infection, site not specified',             'Urinary Tract Infection (UTI)', 'general'),
  ('N76.0', 'Acute vaginitis',                                         'Vaginal Infection',            'gynaecological'),
  ('N94.6', 'Dysmenorrhoea, unspecified',                              'Painful Periods',              'gynaecological'),
  ('O20.0', 'Threatened abortion',                                     'Threatened Miscarriage',       'gynaecological'),
  ('F32.9', 'Depressive episode, unspecified',                         'Depression',                   'mental_health'),
  ('F41.1', 'Generalised anxiety disorder',                            'Anxiety',                      'mental_health'),
  ('F10.2', 'Alcohol dependence syndrome',                             'Alcohol Use Disorder',         'mental_health'),
  ('R50.9', 'Fever, unspecified',                                      'Fever',                        'general'),
  ('R05',   'Cough',                                                   'Cough',                        'general'),
  ('R11.2', 'Nausea with vomiting, unspecified',                       'Nausea and Vomiting',          'general'),
  ('R10.4', 'Other and unspecified abdominal pain',                    'Abdominal Pain',               'general'),
  ('R25.2', 'Cramp and spasm',                                         'Body Pains / Myalgia',         'general'),
  ('Z00.0', 'Encounter for general adult medical examination',         'Routine Medical Check-Up',     'general')
on conflict do nothing;


-- ── 8. icd10_full (lookup table for ICD-10 search) ───────────
create table if not exists icd10_full (
  code         text primary key,
  description  text not null
);

create index if not exists icd10_full_description_idx
  on icd10_full using gin(to_tsvector('english', description));

alter table icd10_full enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'icd10_full' and policyname = 'anyone_read_icd10'
  ) then
    create policy anyone_read_icd10 on icd10_full
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Seed with common ICD-10 codes (same as catalogue, plus broader coverage)
insert into icd10_full (code, description) values
  ('A00.0','Cholera due to Vibrio cholerae 01, biovar cholerae'),
  ('A00.1','Cholera due to Vibrio cholerae 01, biovar eltor'),
  ('A00.9','Cholera, unspecified'),
  ('A01.0','Typhoid fever'),
  ('A01.1','Paratyphoid fever A'),
  ('A01.2','Paratyphoid fever B'),
  ('A01.3','Paratyphoid fever C'),
  ('A01.4','Paratyphoid fever, unspecified'),
  ('A02.0','Salmonella enteritis'),
  ('A02.1','Salmonella septicaemia'),
  ('A02.9','Salmonella infection, unspecified'),
  ('A06.0','Acute amoebic dysentery'),
  ('A06.1','Chronic intestinal amoebiasis'),
  ('A06.9','Amoebiasis, unspecified'),
  ('A09','Diarrhoea and gastroenteritis of presumed infectious origin'),
  ('A15.0','Pulmonary tuberculosis confirmed by sputum microscopy'),
  ('A15.9','Pulmonary tuberculosis, unspecified'),
  ('A17.0','Tuberculous meningitis'),
  ('A20.0','Bubonic plague'),
  ('A27.9','Leptospirosis, unspecified'),
  ('A36.0','Pharyngeal diphtheria'),
  ('A37.0','Whooping cough due to Bordetella pertussis'),
  ('A38','Scarlet fever'),
  ('A40.0','Septicaemia due to Streptococcus Group A'),
  ('A41.9','Septicaemia, unspecified'),
  ('A46','Erysipelas'),
  ('A49.0','Staphylococcal infection, unspecified'),
  ('A50.9','Congenital syphilis, unspecified'),
  ('A51.0','Primary genital syphilis'),
  ('A54.9','Gonococcal infection, unspecified'),
  ('A56.0','Chlamydial infection of lower genitourinary tract'),
  ('A59.0','Urogenital trichomoniasis'),
  ('A60.0','Herpesviral infection of genitalia and urogenital tract'),
  ('A63.0','Anogenital warts'),
  ('A69.2','Lyme disease'),
  ('A80.9','Acute poliomyelitis, unspecified'),
  ('A82.9','Rabies, unspecified'),
  ('A83.9','Mosquito-borne viral encephalitis, unspecified'),
  ('A90','Dengue fever'),
  ('A91','Dengue haemorrhagic fever'),
  ('A98.4','Ebola virus disease'),
  ('B00.9','Herpesviral infection, unspecified'),
  ('B01.9','Varicella without complications'),
  ('B02.9','Zoster without complications'),
  ('B05.9','Measles without complications'),
  ('B06.9','Rubella without complications'),
  ('B08.4','Enteroviral vesicular stomatitis with exanthem'),
  ('B15.9','Acute hepatitis A without hepatic coma'),
  ('B16.9','Acute hepatitis B without delta-agent and without hepatic coma'),
  ('B17.9','Acute viral hepatitis, unspecified'),
  ('B18.1','Chronic viral hepatitis B without delta-agent'),
  ('B18.2','Chronic viral hepatitis C'),
  ('B19.9','Unspecified viral hepatitis without hepatic coma'),
  ('B20','Human immunodeficiency virus disease'),
  ('B24','Unspecified human immunodeficiency virus disease'),
  ('B35.1','Tinea unguium'),
  ('B35.4','Tinea corporis'),
  ('B37.0','Candidal stomatitis'),
  ('B37.9','Candidiasis, unspecified'),
  ('B50.0','Plasmodium falciparum malaria with cerebral complications'),
  ('B50.9','Plasmodium falciparum malaria, unspecified'),
  ('B51.9','Plasmodium vivax malaria without complications'),
  ('B54','Unspecified malaria'),
  ('B55.1','Cutaneous leishmaniasis'),
  ('B65.9','Schistosomiasis, unspecified'),
  ('B68.0','Taenia solium taeniasis'),
  ('B76.9','Hookworm disease, unspecified'),
  ('B77.9','Ascariasis, unspecified'),
  ('B82.0','Intestinal helminthiasis, unspecified'),
  ('C00.9','Malignant neoplasm of lip, unspecified'),
  ('C18.9','Malignant neoplasm of colon, unspecified'),
  ('C34.9','Malignant neoplasm of bronchus and lung, unspecified'),
  ('C50.9','Malignant neoplasm of breast, unspecified'),
  ('C53.9','Malignant neoplasm of cervix uteri, unspecified'),
  ('C61','Malignant neoplasm of prostate'),
  ('C73','Malignant neoplasm of thyroid gland'),
  ('D50.9','Iron deficiency anaemia, unspecified'),
  ('D51.0','Vitamin B12 deficiency anaemia due to intrinsic factor deficiency'),
  ('D52.9','Folate deficiency anaemia, unspecified'),
  ('D64.9','Anaemia, unspecified'),
  ('E03.9','Hypothyroidism, unspecified'),
  ('E05.9','Thyrotoxicosis, unspecified'),
  ('E10.9','Type 1 diabetes mellitus without complications'),
  ('E11.9','Type 2 diabetes mellitus without complications'),
  ('E11.65','Type 2 diabetes mellitus with hyperglycaemia'),
  ('E14.9','Unspecified diabetes mellitus without complications'),
  ('E43','Unspecified severe protein-energy malnutrition'),
  ('E44.0','Moderate protein-energy malnutrition'),
  ('E46','Unspecified protein-energy malnutrition'),
  ('E55.9','Vitamin D deficiency, unspecified'),
  ('E61.1','Iron deficiency'),
  ('E66.9','Obesity, unspecified'),
  ('E78.5','Hyperlipidaemia, unspecified'),
  ('E87.1','Hypo-osmolality and hyponatraemia'),
  ('E87.6','Hypokalaemia'),
  ('F10.2','Alcohol dependence syndrome'),
  ('F17.2','Tobacco dependence'),
  ('F19.1','Mental and behavioural disorders due to multiple drug use, harmful use'),
  ('F20.9','Schizophrenia, unspecified'),
  ('F32.9','Depressive episode, unspecified'),
  ('F33.9','Recurrent depressive disorder, unspecified'),
  ('F40.1','Social phobias'),
  ('F41.0','Panic disorder'),
  ('F41.1','Generalised anxiety disorder'),
  ('F43.1','Post-traumatic stress disorder'),
  ('F51.0','Nonorganic insomnia'),
  ('G20','Parkinson''s disease'),
  ('G35','Multiple sclerosis'),
  ('G40.9','Epilepsy, unspecified'),
  ('G43.0','Migraine without aura'),
  ('G43.1','Migraine with aura'),
  ('G43.9','Migraine, unspecified'),
  ('G44.2','Tension-type headache'),
  ('G47.0','Disorders of initiating and maintaining sleep (insomnias)'),
  ('G63.2','Diabetic polyneuropathy'),
  ('H00.0','Hordeolum and other deep inflammation of eyelid'),
  ('H01.0','Blepharitis'),
  ('H10.9','Conjunctivitis, unspecified'),
  ('H52.1','Myopia'),
  ('H52.4','Presbyopia'),
  ('H60.9','Otitis externa, unspecified'),
  ('H65.9','Nonsuppurative otitis media, unspecified'),
  ('H66.9','Otitis media, unspecified'),
  ('H83.3','Noise effects on inner ear'),
  ('H91.9','Hearing loss, unspecified'),
  ('I10','Essential (primary) hypertension'),
  ('I20.9','Angina pectoris, unspecified'),
  ('I21.9','Acute myocardial infarction, unspecified'),
  ('I25.1','Atherosclerotic heart disease of native coronary artery'),
  ('I48.0','Paroxysmal atrial fibrillation'),
  ('I48.9','Atrial fibrillation and flutter, unspecified'),
  ('I50.0','Congestive heart failure'),
  ('I50.9','Heart failure, unspecified'),
  ('I63.9','Cerebral infarction, unspecified'),
  ('I64','Stroke, not specified as haemorrhage or infarction'),
  ('I73.9','Peripheral vascular disease, unspecified'),
  ('I83.9','Varicose veins of lower extremities without ulcer or inflammation'),
  ('J00','Acute nasopharyngitis (common cold)'),
  ('J02.9','Acute pharyngitis, unspecified'),
  ('J03.9','Acute tonsillitis, unspecified'),
  ('J04.0','Acute laryngitis'),
  ('J06.9','Acute upper respiratory infection, unspecified'),
  ('J11.1','Influenza with other respiratory manifestations'),
  ('J18.9','Pneumonia, unspecified organism'),
  ('J20.9','Acute bronchitis, unspecified'),
  ('J30.1','Allergic rhinitis due to pollen'),
  ('J30.9','Allergic rhinitis, unspecified'),
  ('J32.0','Chronic maxillary sinusitis'),
  ('J32.9','Chronic sinusitis, unspecified'),
  ('J38.7','Other diseases of larynx'),
  ('J45.0','Predominantly allergic asthma'),
  ('J45.9','Asthma, uncomplicated'),
  ('J96.0','Acute respiratory failure'),
  ('K02.9','Dental caries, unspecified'),
  ('K05.1','Chronic gingivitis'),
  ('K08.1','Loss of teeth due to accident, extraction or local periodontal disease'),
  ('K21.0','Gastro-oesophageal reflux disease with oesophagitis'),
  ('K21.9','Gastro-oesophageal reflux disease without oesophagitis'),
  ('K25.9','Gastric ulcer, unspecified as acute or chronic'),
  ('K27.9','Peptic ulcer, unspecified'),
  ('K29.0','Acute haemorrhagic gastritis'),
  ('K29.7','Gastritis, unspecified'),
  ('K35.9','Acute appendicitis, unspecified'),
  ('K40.9','Unilateral or unspecified inguinal hernia without obstruction or gangrene'),
  ('K57.9','Diverticular disease of intestine, part unspecified'),
  ('K59.0','Constipation'),
  ('K59.1','Functional diarrhoea'),
  ('K59.4','Anal spasm'),
  ('K70.0','Alcoholic fatty liver'),
  ('K73.9','Chronic hepatitis, unspecified'),
  ('K76.0','Fatty (change of) liver, not elsewhere classified'),
  ('K80.2','Calculus of gallbladder without cholecystitis'),
  ('K85.9','Acute pancreatitis, unspecified'),
  ('K92.1','Melaena'),
  ('L01.0','Impetigo due to Staphylococcus aureus'),
  ('L02.9','Cutaneous abscess, furuncle and carbuncle, unspecified'),
  ('L03.9','Cellulitis, unspecified'),
  ('L08.9','Local infection of skin and subcutaneous tissue, unspecified'),
  ('L20.9','Atopic dermatitis, unspecified'),
  ('L23.9','Allergic contact dermatitis, unspecified'),
  ('L29.9','Pruritus, unspecified'),
  ('L30.9','Dermatitis, unspecified'),
  ('L40.0','Psoriasis vulgaris'),
  ('L50.9','Urticaria, unspecified'),
  ('L60.0','Ingrowing nail'),
  ('L70.0','Acne vulgaris'),
  ('L72.0','Epidermal cyst'),
  ('M05.9','Seropositive rheumatoid arthritis, unspecified'),
  ('M06.9','Rheumatoid arthritis, unspecified'),
  ('M10.9','Gout, unspecified'),
  ('M15.9','Polyarthrosis, unspecified'),
  ('M16.9','Coxarthrosis, unspecified'),
  ('M17.9','Gonarthrosis, unspecified'),
  ('M19.9','Arthrosis, unspecified'),
  ('M25.5','Pain in joint'),
  ('M47.9','Spondylosis, unspecified'),
  ('M54.2','Cervicalgia'),
  ('M54.4','Lumbago with sciatica'),
  ('M54.5','Low back pain'),
  ('M65.9','Synovitis and tenosynovitis, unspecified'),
  ('M79.1','Myalgia'),
  ('M79.3','Panniculitis, unspecified'),
  ('N00.9','Acute nephritic syndrome, unspecified'),
  ('N18.9','Chronic kidney disease, unspecified'),
  ('N20.0','Calculus of kidney'),
  ('N28.9','Disorder of kidney and ureter, unspecified'),
  ('N39.0','Urinary tract infection, site not specified'),
  ('N40','Enlarged prostate'),
  ('N41.0','Acute prostatitis'),
  ('N42.1','Congestion and haemorrhage of prostate'),
  ('N43.9','Hydrocele, unspecified'),
  ('N63','Unspecified lump in breast'),
  ('N76.0','Acute vaginitis'),
  ('N80.0','Endometriosis of uterus'),
  ('N91.2','Amenorrhoea, unspecified'),
  ('N92.0','Excessive and frequent menstruation with regular cycle'),
  ('N94.6','Dysmenorrhoea, unspecified'),
  ('N95.1','Menopausal and female climacteric states'),
  ('O10.0','Pre-existing essential hypertension complicating pregnancy'),
  ('O20.0','Threatened abortion'),
  ('O24.4','Diabetes mellitus arising in pregnancy'),
  ('O26.6','Liver disorders in pregnancy'),
  ('P07.3','Other preterm infants'),
  ('Q21.1','Atrial septal defect'),
  ('Q65.0','Congenital dislocation of hip, unilateral'),
  ('R00.0','Tachycardia, unspecified'),
  ('R00.1','Bradycardia, unspecified'),
  ('R01.1','Cardiac murmur, unspecified'),
  ('R04.2','Haemoptysis'),
  ('R05','Cough'),
  ('R06.0','Dyspnoea'),
  ('R06.2','Wheezing'),
  ('R07.0','Pain in throat'),
  ('R07.4','Chest pain, unspecified'),
  ('R10.4','Other and unspecified abdominal pain'),
  ('R11.0','Nausea'),
  ('R11.2','Nausea with vomiting, unspecified'),
  ('R17','Unspecified jaundice'),
  ('R19.7','Diarrhoea, unspecified'),
  ('R20.2','Paraesthesia of skin'),
  ('R25.2','Cramp and spasm'),
  ('R42','Dizziness and giddiness'),
  ('R50.9','Fever, unspecified'),
  ('R51','Headache'),
  ('R53.1','Weakness'),
  ('R55','Syncope and collapse'),
  ('R56.9','Unspecified convulsions'),
  ('R58','Haemorrhage, not elsewhere classified'),
  ('R60.0','Localised oedema'),
  ('R60.9','Oedema, unspecified'),
  ('R73.0','Abnormal glucose'),
  ('R73.9','Hyperglycaemia, unspecified'),
  ('S09.9','Unspecified injury of head'),
  ('S29.9','Unspecified injury of thorax'),
  ('S39.9','Unspecified injury of abdomen'),
  ('S69.9','Unspecified injury of wrist and hand'),
  ('S99.9','Unspecified injury of ankle and foot'),
  ('T14.9','Injury, unspecified'),
  ('T40.9','Poisoning by unspecified psychodysleptics'),
  ('T78.1','Other adverse food reactions, not elsewhere classified'),
  ('T78.4','Allergy, unspecified'),
  ('Z00.0','Encounter for general adult medical examination'),
  ('Z00.1','Encounter for newborn, infant and child health examinations'),
  ('Z03.9','Encounter for observation for suspected diseases and conditions, ruled out'),
  ('Z11.0','Encounter for screening examination for intestinal infectious diseases'),
  ('Z23','Encounter for immunization'),
  ('Z30.0','Encounter for general counselling and advice on contraception'),
  ('Z71.3','Encounter for dietary counselling and surveillance'),
  ('Z87.1','Personal history of infectious and parasitic diseases')
on conflict (code) do nothing;


-- ── 9. users: add email and share_medical_records columns ────
alter table users add column if not exists email text;
alter table users add column if not exists share_medical_records boolean not null default true;

-- Backfill email from auth.users for existing rows
update users u
set email = au.email
from auth.users au
where u.id = au.id
  and u.email is null;

-- Keep email in sync when auth.users is updated
create or replace function sync_user_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update users set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function sync_user_email_from_auth();

-- Also populate email on new user creation (fires after the existing
-- handle_new_user trigger that creates the users row)
drop trigger if exists on_auth_user_email_inserted on auth.users;
create trigger on_auth_user_email_inserted
  after insert on auth.users
  for each row
  execute function sync_user_email_from_auth();
