-- Replace blood_pressure_check and malaria_typhoid_test with wellness_check
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_service_type_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_service_type_check CHECK (service_type IN (
    'general_consultation', 'wellness_check',
    'wound_care', 'elderly_review', 'nursing_care', 'custom_request'
  ));