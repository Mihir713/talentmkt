-- Reference catalog: universities, programs, courses, the fixed skill taxonomy, and job regions.
-- Universities, programs and courses are filled by the seed script (and by students confirming
-- unknown courses). Skill tags and job regions are fixed reference data and live here.

create table public.universities (
  id           bigint generated always as identity primary key,
  name         text not null unique,
  short_name   text not null unique,
  email_domain text not null unique
    check (email_domain = lower(email_domain) and email_domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  region       text not null check (region ~ '^[A-Z]{2}$')   -- province / state code, e.g. ON
);

create table public.programs (
  id            bigint generated always as identity primary key,
  university_id bigint not null references public.universities (id),
  name          text not null,
  faculty       text not null,
  unique (university_id, name),
  -- Lets student_profiles prove its program belongs to its university.
  unique (id, university_id)
);

create table public.courses (
  id            bigint generated always as identity primary key,
  university_id bigint not null references public.universities (id),
  code          text not null check (code = upper(btrim(code)) and length(code) between 2 and 20),
  title         text not null check (length(btrim(title)) between 1 and 200),
  level         int not null check (level between 1 and 8),   -- year level: ECE 222 -> 2
  unique (university_id, code)
);

create index courses_title_trgm_idx on public.courses using gin (title extensions.gin_trgm_ops);

create table public.skill_tags (
  id       bigint generated always as identity primary key,
  slug     text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label    text not null unique,
  category text not null
);

create table public.course_skill_tags (
  course_id    bigint not null references public.courses (id) on delete cascade,
  skill_tag_id bigint not null references public.skill_tags (id),
  weight       numeric(3, 2) not null check (weight > 0 and weight <= 1),
  primary key (course_id, skill_tag_id)
);

create index course_skill_tags_skill_tag_id_idx on public.course_skill_tags (skill_tag_id);

-- Where an outcome report says someone works. Markets resolve against these codes, so they are
-- a closed list rather than free text.
create table public.job_regions (
  code    text primary key check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label   text not null unique,
  phrase  text not null,   -- how it reads after "employed": "in the SF Bay Area", "elsewhere in Canada"
  country text not null check (country in ('CA', 'US', 'other', 'remote'))
);

insert into public.skill_tags (slug, label, category) values
  -- Software
  ('software-engineering',   'Software engineering',        'Software'),
  ('algorithms',             'Algorithms',                  'Software'),
  ('systems-programming',    'Systems programming',         'Software'),
  ('operating-systems',      'Operating systems',           'Software'),
  ('distributed-systems',    'Distributed systems',         'Software'),
  ('databases',              'Databases',                   'Software'),
  ('networking',             'Computer networks',           'Software'),
  ('security',               'Security',                    'Software'),
  ('compilers',              'Compilers & languages',       'Software'),
  ('web-development',        'Web development',             'Software'),
  ('mobile-development',     'Mobile development',          'Software'),
  ('cloud-infrastructure',   'Cloud infrastructure',        'Software'),
  ('hci',                    'Human-computer interaction',  'Software'),
  ('computer-graphics',      'Computer graphics',           'Software'),
  -- Data & AI
  ('ml',                     'Machine learning',            'Data & AI'),
  ('deep-learning',          'Deep learning',               'Data & AI'),
  ('nlp',                    'Natural language processing', 'Data & AI'),
  ('computer-vision',        'Computer vision',             'Data & AI'),
  ('data-engineering',       'Data engineering',            'Data & AI'),
  ('statistics',             'Statistics',                  'Data & AI'),
  ('optimization',           'Optimization',                'Data & AI'),
  -- Electrical & computer
  ('embedded-systems',       'Embedded systems',            'Electrical'),
  ('computer-architecture',  'Computer architecture',       'Electrical'),
  ('vlsi-digital',           'VLSI & digital design',       'Electrical'),
  ('rf-analog',              'RF & analog circuits',        'Electrical'),
  ('signal-processing',      'Signal processing',           'Electrical'),
  ('communications',         'Communication systems',       'Electrical'),
  ('control-systems',        'Control systems',             'Electrical'),
  ('power-systems',          'Power systems',               'Electrical'),
  ('power-electronics',      'Power electronics',           'Electrical'),
  ('photonics',              'Photonics',                   'Electrical'),
  -- Mechanical & aerospace
  ('cad-mechanical',         'Mechanical design & CAD',     'Mechanical'),
  ('thermofluids',           'Thermofluids',                'Mechanical'),
  ('solid-mechanics',        'Solid mechanics',             'Mechanical'),
  ('robotics',               'Robotics',                    'Mechanical'),
  ('mechatronics',           'Mechatronics',                'Mechanical'),
  ('manufacturing',          'Manufacturing',               'Mechanical'),
  ('aerospace',              'Aerospace',                   'Mechanical'),
  -- Civil & environmental
  ('structural',             'Structural engineering',      'Civil'),
  ('geotechnical',           'Geotechnical engineering',    'Civil'),
  ('transportation',         'Transportation',              'Civil'),
  ('environmental',          'Environmental engineering',   'Civil'),
  ('water-resources',        'Water resources',             'Civil'),
  -- Chemical, materials, bio
  ('process-engineering',    'Chemical process engineering','Chemical & bio'),
  ('materials',              'Materials science',           'Chemical & bio'),
  ('biomedical',             'Biomedical engineering',      'Chemical & bio'),
  ('biotech',                'Biotechnology',               'Chemical & bio'),
  -- Math & physical science
  ('applied-math',           'Applied mathematics',         'Math & science'),
  ('physics',                'Physics',                     'Math & science'),
  ('quantum',                'Quantum computing',           'Math & science'),
  -- Finance & business
  ('quant-finance',          'Quantitative finance',        'Finance & business'),
  ('economics',              'Economics',                   'Finance & business'),
  ('operations-research',    'Operations research',         'Finance & business'),
  ('product-management',     'Product management',          'Finance & business');

insert into public.job_regions (code, label, phrase, country) values
  ('sf-bay-area',   'SF Bay Area',               'in the SF Bay Area',          'US'),
  ('seattle',       'Seattle',                   'in Seattle',                  'US'),
  ('nyc',           'New York City',             'in New York City',            'US'),
  ('boston',        'Boston',                    'in Boston',                   'US'),
  ('other-us',      'Elsewhere in the US',       'elsewhere in the US',         'US'),
  ('toronto',       'Greater Toronto Area',      'in the Greater Toronto Area', 'CA'),
  ('waterloo',      'Waterloo Region',           'in Waterloo Region',          'CA'),
  ('ottawa',        'Ottawa',                    'in Ottawa',                   'CA'),
  ('montreal',      'Montreal',                  'in Montreal',                 'CA'),
  ('vancouver',     'Vancouver',                 'in Vancouver',                'CA'),
  ('calgary',       'Calgary',                   'in Calgary',                  'CA'),
  ('other-canada',  'Elsewhere in Canada',       'elsewhere in Canada',         'CA'),
  ('international', 'Outside Canada and the US','outside Canada and the US',   'other'),
  ('remote',        'Fully remote',              'in a fully remote role',      'remote');
