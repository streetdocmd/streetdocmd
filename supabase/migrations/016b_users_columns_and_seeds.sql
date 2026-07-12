-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS share_medical_records boolean NOT NULL DEFAULT true;

-- Backfill email from auth.users for existing rows
UPDATE users u
SET email = au.email
FROM auth.users au
WHERE u.id = au.id AND u.email IS NULL;

-- Keep email in sync when auth email changes
CREATE OR REPLACE FUNCTION sync_user_email_from_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION sync_user_email_from_auth();

DROP TRIGGER IF EXISTS on_auth_user_email_inserted ON auth.users;
CREATE TRIGGER on_auth_user_email_inserted
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_email_from_auth();

-- Seed streetdocmd_diagnoses curated catalogue
INSERT INTO streetdocmd_diagnoses (icd10_code, clinical_description, plain_language, category) VALUES
  ('B54',   'Unspecified malaria',                                     'Malaria',                           'infectious'),
  ('B50.9', 'Plasmodium falciparum malaria, uncomplicated',            'Falciparum Malaria',                'infectious'),
  ('A01.0', 'Typhoid fever due to Salmonella typhi',                   'Typhoid Fever',                     'infectious'),
  ('A09',   'Other and unspecified gastroenteritis and colitis',       'Gastroenteritis / Stooling',        'infectious'),
  ('A06.0', 'Acute amoebiasis',                                        'Amoebic Dysentery',                 'infectious'),
  ('B17.9', 'Acute viral hepatitis, unspecified',                      'Hepatitis',                         'infectious'),
  ('B20',   'Human immunodeficiency virus disease',                    'HIV',                               'infectious'),
  ('A15.0', 'Pulmonary tuberculosis',                                  'Tuberculosis (TB)',                  'infectious'),
  ('J00',   'Acute nasopharyngitis',                                   'Common Cold',                       'respiratory'),
  ('J06.9', 'Acute upper respiratory infection, unspecified',          'Upper Respiratory Tract Infection', 'respiratory'),
  ('J03.9', 'Acute tonsillitis, unspecified',                          'Tonsillitis / Sore Throat',         'respiratory'),
  ('J18.9', 'Pneumonia, unspecified organism',                         'Pneumonia',                         'respiratory'),
  ('J45.9', 'Asthma, uncomplicated',                                   'Asthma',                            'respiratory'),
  ('J20.9', 'Acute bronchitis, unspecified',                           'Bronchitis',                        'respiratory'),
  ('I10',   'Essential (primary) hypertension',                        'Hypertension (High Blood Pressure)','cardiovascular'),
  ('I50.9', 'Heart failure, unspecified',                              'Heart Failure',                     'cardiovascular'),
  ('E11.9', 'Type 2 diabetes mellitus without complications',          'Type 2 Diabetes',                   'endocrine'),
  ('E10.9', 'Type 1 diabetes mellitus without complications',          'Type 1 Diabetes',                   'endocrine'),
  ('E03.9', 'Hypothyroidism, unspecified',                             'Underactive Thyroid',               'endocrine'),
  ('E78.5', 'Hyperlipidemia, unspecified',                             'High Cholesterol',                  'endocrine'),
  ('G43.9', 'Migraine, unspecified',                                   'Migraine',                          'neurological'),
  ('R51',   'Headache',                                                'Headache',                          'neurological'),
  ('G40.9', 'Epilepsy, unspecified',                                   'Epilepsy / Seizures',               'neurological'),
  ('K21.9', 'Gastro-oesophageal reflux disease without oesophagitis', 'Acid Reflux / GERD',                'gastrointestinal'),
  ('K29.7', 'Gastritis, unspecified',                                  'Stomach Inflammation (Gastritis)',  'gastrointestinal'),
  ('K59.0', 'Constipation',                                            'Constipation',                      'gastrointestinal'),
  ('K59.1', 'Functional diarrhoea',                                    'Diarrhoea',                         'gastrointestinal'),
  ('M54.5', 'Low back pain',                                           'Low Back Pain',                     'musculoskeletal'),
  ('M79.1', 'Myalgia',                                                 'Body Pains / Myalgia',              'musculoskeletal'),
  ('M06.9', 'Rheumatoid arthritis, unspecified',                       'Rheumatoid Arthritis',              'musculoskeletal'),
  ('L50.9', 'Urticaria, unspecified',                                  'Hives / Urticaria',                 'dermatological'),
  ('L30.9', 'Dermatitis, unspecified',                                 'Skin Rash / Dermatitis',            'dermatological'),
  ('L70.0', 'Acne vulgaris',                                           'Acne',                              'dermatological'),
  ('B35.4', 'Tinea corporis',                                          'Ringworm / Fungal Skin Infection',  'dermatological'),
  ('N39.0', 'Urinary tract infection, site not specified',             'Urinary Tract Infection (UTI)',     'general'),
  ('N76.0', 'Acute vaginitis',                                         'Vaginal Infection',                 'gynaecological'),
  ('N94.6', 'Dysmenorrhoea, unspecified',                              'Painful Periods',                   'gynaecological'),
  ('O20.0', 'Threatened abortion',                                     'Threatened Miscarriage',            'gynaecological'),
  ('F32.9', 'Depressive episode, unspecified',                         'Depression',                        'mental_health'),
  ('F41.1', 'Generalised anxiety disorder',                            'Anxiety',                           'mental_health'),
  ('R50.9', 'Fever, unspecified',                                      'Fever',                             'general'),
  ('R05',   'Cough',                                                   'Cough',                             'general'),
  ('R11.2', 'Nausea with vomiting, unspecified',                       'Nausea and Vomiting',               'general'),
  ('R10.4', 'Other and unspecified abdominal pain',                    'Abdominal Pain',                    'general'),
  ('R60.9', 'Oedema, unspecified',                                     'Swelling / Oedema',                 'general'),
  ('R42',   'Dizziness and giddiness',                                 'Dizziness',                         'general'),
  ('D64.9', 'Anaemia, unspecified',                                    'Anaemia',                           'general'),
  ('Z00.0', 'Encounter for general adult medical examination',         'Routine Medical Check-Up',          'general')
ON CONFLICT DO NOTHING;

-- Seed icd10_full with common codes (providers can search these)
INSERT INTO icd10_full (code, description) VALUES
  ('A01.0','Typhoid fever'),('A06.0','Acute amoebic dysentery'),('A09','Diarrhoea and gastroenteritis'),
  ('A15.0','Pulmonary tuberculosis'),('A15.9','Pulmonary tuberculosis, unspecified'),
  ('A27.9','Leptospirosis, unspecified'),('A36.0','Pharyngeal diphtheria'),
  ('A37.0','Whooping cough due to Bordetella pertussis'),('A38','Scarlet fever'),
  ('A41.9','Septicaemia, unspecified'),('A46','Erysipelas'),
  ('A49.0','Staphylococcal infection, unspecified'),('A54.9','Gonococcal infection, unspecified'),
  ('A56.0','Chlamydial infection of lower genitourinary tract'),
  ('A59.0','Urogenital trichomoniasis'),('A60.0','Herpesviral infection of genitalia'),
  ('A63.0','Anogenital warts'),('A82.9','Rabies, unspecified'),
  ('A90','Dengue fever'),('A91','Dengue haemorrhagic fever'),
  ('B00.9','Herpesviral infection, unspecified'),('B01.9','Varicella without complications'),
  ('B02.9','Zoster without complications'),('B05.9','Measles without complications'),
  ('B06.9','Rubella without complications'),('B15.9','Acute hepatitis A'),
  ('B16.9','Acute hepatitis B'),('B17.9','Acute viral hepatitis, unspecified'),
  ('B18.1','Chronic viral hepatitis B'),('B18.2','Chronic viral hepatitis C'),
  ('B19.9','Unspecified viral hepatitis'),('B20','Human immunodeficiency virus disease'),
  ('B24','Unspecified HIV disease'),('B35.1','Tinea unguium'),
  ('B35.4','Tinea corporis'),('B37.0','Candidal stomatitis'),
  ('B37.9','Candidiasis, unspecified'),('B50.0','Plasmodium falciparum malaria with cerebral complications'),
  ('B50.9','Plasmodium falciparum malaria, unspecified'),('B51.9','Plasmodium vivax malaria'),
  ('B54','Unspecified malaria'),('B65.9','Schistosomiasis, unspecified'),
  ('B76.9','Hookworm disease, unspecified'),('B77.9','Ascariasis, unspecified'),
  ('B82.0','Intestinal helminthiasis, unspecified'),
  ('C34.9','Malignant neoplasm of bronchus and lung, unspecified'),
  ('C50.9','Malignant neoplasm of breast, unspecified'),
  ('C53.9','Malignant neoplasm of cervix uteri, unspecified'),
  ('C61','Malignant neoplasm of prostate'),('C73','Malignant neoplasm of thyroid gland'),
  ('D50.9','Iron deficiency anaemia, unspecified'),
  ('D52.9','Folate deficiency anaemia, unspecified'),('D64.9','Anaemia, unspecified'),
  ('E03.9','Hypothyroidism, unspecified'),('E05.9','Thyrotoxicosis, unspecified'),
  ('E10.9','Type 1 diabetes mellitus without complications'),
  ('E11.9','Type 2 diabetes mellitus without complications'),
  ('E43','Severe protein-energy malnutrition'),('E46','Protein-energy malnutrition'),
  ('E55.9','Vitamin D deficiency, unspecified'),('E66.9','Obesity, unspecified'),
  ('E78.5','Hyperlipidaemia, unspecified'),
  ('F10.2','Alcohol dependence syndrome'),('F17.2','Tobacco dependence'),
  ('F20.9','Schizophrenia, unspecified'),('F32.9','Depressive episode, unspecified'),
  ('F33.9','Recurrent depressive disorder, unspecified'),('F40.1','Social phobias'),
  ('F41.0','Panic disorder'),('F41.1','Generalised anxiety disorder'),
  ('F43.1','Post-traumatic stress disorder'),('F51.0','Nonorganic insomnia'),
  ('G20','Parkinson''s disease'),('G35','Multiple sclerosis'),
  ('G40.9','Epilepsy, unspecified'),('G43.0','Migraine without aura'),
  ('G43.1','Migraine with aura'),('G43.9','Migraine, unspecified'),
  ('G44.2','Tension-type headache'),('G63.2','Diabetic polyneuropathy'),
  ('H10.9','Conjunctivitis, unspecified'),('H52.1','Myopia'),
  ('H60.9','Otitis externa, unspecified'),('H65.9','Nonsuppurative otitis media, unspecified'),
  ('H66.9','Otitis media, unspecified'),('H91.9','Hearing loss, unspecified'),
  ('I10','Essential (primary) hypertension'),('I20.9','Angina pectoris, unspecified'),
  ('I21.9','Acute myocardial infarction, unspecified'),
  ('I25.1','Atherosclerotic heart disease of native coronary artery'),
  ('I48.9','Atrial fibrillation and flutter, unspecified'),
  ('I50.0','Congestive heart failure'),('I50.9','Heart failure, unspecified'),
  ('I64','Stroke, not specified as haemorrhage or infarction'),
  ('I73.9','Peripheral vascular disease, unspecified'),
  ('J00','Acute nasopharyngitis (common cold)'),('J02.9','Acute pharyngitis, unspecified'),
  ('J03.9','Acute tonsillitis, unspecified'),('J04.0','Acute laryngitis'),
  ('J06.9','Acute upper respiratory infection, unspecified'),
  ('J11.1','Influenza with other respiratory manifestations'),
  ('J18.9','Pneumonia, unspecified organism'),('J20.9','Acute bronchitis, unspecified'),
  ('J30.1','Allergic rhinitis due to pollen'),('J30.9','Allergic rhinitis, unspecified'),
  ('J32.0','Chronic maxillary sinusitis'),('J32.9','Chronic sinusitis, unspecified'),
  ('J45.0','Predominantly allergic asthma'),('J45.9','Asthma, uncomplicated'),
  ('K02.9','Dental caries, unspecified'),('K05.1','Chronic gingivitis'),
  ('K21.0','Gastro-oesophageal reflux disease with oesophagitis'),
  ('K21.9','Gastro-oesophageal reflux disease without oesophagitis'),
  ('K25.9','Gastric ulcer, unspecified'),('K29.0','Acute haemorrhagic gastritis'),
  ('K29.7','Gastritis, unspecified'),('K35.9','Acute appendicitis, unspecified'),
  ('K40.9','Unilateral inguinal hernia without obstruction'),
  ('K57.9','Diverticular disease of intestine, unspecified'),
  ('K59.0','Constipation'),('K59.1','Functional diarrhoea'),
  ('K70.0','Alcoholic fatty liver'),('K73.9','Chronic hepatitis, unspecified'),
  ('K76.0','Fatty liver, not elsewhere classified'),
  ('K80.2','Calculus of gallbladder without cholecystitis'),
  ('K85.9','Acute pancreatitis, unspecified'),
  ('L01.0','Impetigo due to Staphylococcus aureus'),
  ('L02.9','Cutaneous abscess, furuncle and carbuncle, unspecified'),
  ('L03.9','Cellulitis, unspecified'),('L08.9','Local infection of skin, unspecified'),
  ('L20.9','Atopic dermatitis, unspecified'),('L23.9','Allergic contact dermatitis, unspecified'),
  ('L29.9','Pruritus, unspecified'),('L30.9','Dermatitis, unspecified'),
  ('L40.0','Psoriasis vulgaris'),('L50.9','Urticaria, unspecified'),
  ('L70.0','Acne vulgaris'),('L72.0','Epidermal cyst'),
  ('M05.9','Seropositive rheumatoid arthritis, unspecified'),
  ('M06.9','Rheumatoid arthritis, unspecified'),('M10.9','Gout, unspecified'),
  ('M19.9','Arthrosis, unspecified'),('M25.5','Pain in joint'),
  ('M47.9','Spondylosis, unspecified'),('M54.2','Cervicalgia'),
  ('M54.4','Lumbago with sciatica'),('M54.5','Low back pain'),
  ('M79.1','Myalgia'),('M79.3','Panniculitis, unspecified'),
  ('N18.9','Chronic kidney disease, unspecified'),('N20.0','Calculus of kidney'),
  ('N39.0','Urinary tract infection, site not specified'),
  ('N40','Enlarged prostate'),('N41.0','Acute prostatitis'),
  ('N63','Unspecified lump in breast'),('N76.0','Acute vaginitis'),
  ('N80.0','Endometriosis of uterus'),('N91.2','Amenorrhoea, unspecified'),
  ('N92.0','Excessive and frequent menstruation'),
  ('N94.6','Dysmenorrhoea, unspecified'),('N95.1','Menopausal and female climacteric states'),
  ('O10.0','Pre-existing essential hypertension complicating pregnancy'),
  ('O20.0','Threatened abortion'),
  ('R00.0','Tachycardia, unspecified'),('R00.1','Bradycardia, unspecified'),
  ('R04.2','Haemoptysis'),('R05','Cough'),('R06.0','Dyspnoea'),
  ('R06.2','Wheezing'),('R07.0','Pain in throat'),
  ('R07.4','Chest pain, unspecified'),('R10.4','Other and unspecified abdominal pain'),
  ('R11.0','Nausea'),('R11.2','Nausea with vomiting, unspecified'),
  ('R17','Unspecified jaundice'),('R19.7','Diarrhoea, unspecified'),
  ('R25.2','Cramp and spasm'),('R42','Dizziness and giddiness'),
  ('R50.9','Fever, unspecified'),('R51','Headache'),('R53.1','Weakness'),
  ('R55','Syncope and collapse'),('R56.9','Unspecified convulsions'),
  ('R60.0','Localised oedema'),('R60.9','Oedema, unspecified'),
  ('R73.9','Hyperglycaemia, unspecified'),
  ('T14.9','Injury, unspecified'),('T78.1','Adverse food reactions'),
  ('T78.4','Allergy, unspecified'),
  ('Z00.0','Encounter for general adult medical examination'),
  ('Z23','Encounter for immunization'),
  ('Z71.3','Encounter for dietary counselling'),
  ('Z87.1','Personal history of infectious and parasitic diseases')
ON CONFLICT (code) DO NOTHING;
