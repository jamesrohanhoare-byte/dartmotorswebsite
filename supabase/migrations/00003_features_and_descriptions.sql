-- Add a features/extras list + seed a factual description per car (no data wipe).

alter table vehicles add column if not exists features text[] default '{}';

update vehicles set description =
  'This ' || year || ' ' || make || ' ' || model || ' is presented in excellent condition'
  || coalesce(' with ' || to_char(mileage, 'FM999,999') || ' km on the clock', '') || '. '
  || coalesce(transmission || ' transmission', '')
  || coalesce(', ' || fuel_type, '') || '. '
  || 'Part of Autocrat Motors'' hand-selected, quality-checked collection of premium pre-owned '
  || 'vehicles. Finance arranged through all major banks, trade-ins welcome, and countrywide '
  || 'delivery available.'
where description is null;
