-- Europe scholarships open in October 2026 (other than Erasmus Mundus), requested 2026-10-11.
-- Safe to run more than once. Run in the Supabase SQL editor, then rebuild the site (push or deploy hook).
insert into destinations (code, name, tab_label, currency, show_indicative_fees, sort_order)
values ('FR', 'France', 'Europe', 'EUR', false, 7)
on conflict (code) do nothing;

insert into scholarships (slug, name, provider_type, provider_name, destination_codes, levels, field_slugs, eligible_countries,
  value_type, value_amount, value_currency, value_text, summary, criteria_text, need_based, application_route, requires_offer,
  deadline_on, deadline_note, intake_label, official_url, source_url, verified_on, confidence, featured, review_notes, is_published)
values
('france-excellence-eiffel', 'France Excellence Eiffel Scholarship', 'government', 'French Ministry for Europe and Foreign Affairs (run by Campus France)',
 array['FR'], array['postgraduate','doctoral'],
 array['medicine-health-sciences','science-mathematics','agriculture-environmental-studies','computer-technology','engineering-technology','humanities-social-sciences','law-legal-studies','business-management','accounting-finance'],
 array['INTL'], 'stipend', 1200, 'EUR',
 '€1,200 a month for master''s and €2,100 a month for PhD, plus international travel, insurance and help finding housing. Tuition is not covered.',
 'French government scholarship for international students on master''s, engineering and joint PhD programmes at French universities. Your chosen French university applies for you, so you apply for your course first and ask to be put forward.',
 'Nominated by a French higher education institution. Fields: biology and health, ecological transition, mathematics and digital sciences, engineering, history and French studies, law and political science, economics and management. In the 2026 rules, master''s applicants could be up to 29 years old and PhD applicants up to 35.',
 false, 'nomination', true, null,
 'The 2027 call is open: French universities submit their nominations by 8 January 2027. Most universities set earlier internal deadlines for students, so apply to your course well before then.',
 '2027/28', 'https://www.campusfrance.org/en/the-france-excellence-eiffel-scholarship-program',
 'https://www.campusfrance.org/en/actu/call-for-france-excellence-eiffel-applications-2027', '2026-10-11', 'medium', false,
 'Added 2026-10-11 from Campus France pages: 2027 call open until January 8, 2027 (body text also says January 6); allowances from January 2026; age limits from the 2026 rules.', true),
('daad-study-scholarships-arts', 'DAAD Study Scholarships for the Arts', 'government', 'DAAD (German Academic Exchange Service)',
 array['DE'], array['postgraduate'], array['design-creative-arts','media-communication'], array['INTL'], 'stipend', 992, 'EUR',
 '€992 a month plus travel allowance, a study allowance and insurance, for 10 to 24 months',
 'Scholarships for arts graduates to take a master''s or postgraduate course, or a year of complementary study, at a state or state-recognised German university. There are two strands: fine art, design, visual communication and film; and the performing arts.',
 'A first university degree in an arts field. A portfolio or work samples are submitted after the formal check of your application. You need admission from the German university before the scholarship starts.',
 false, 'separate_application', false, '2026-10-15',
 'Apply on the DAAD portal by 15 October 2026 for funding from October 2027. Selection is in April 2027.',
 '2027/28', 'https://www.daad.pk/en/find-funding/daad-scholarship-programmes-for-pakistan/',
 'https://www.daad.pk/en/find-funding/scholarship-database/?origin=194&status=3&type=a&language=en&detail_to_show=57135742&tab=applicationprocess', '2026-10-11', 'high', false,
 'Added 2026-10-11: DAAD Pakistan database, origin Pakistan, status graduates. Fine Art/Design/Film (57135742) and Performing Arts (50109971) both show deadline 15.10.2026 and 992 euros a month.', true)
on conflict (slug) do update set is_published = true, verified_on = excluded.verified_on, deadline_note = excluded.deadline_note, value_text = excluded.value_text;

update scholarships set
  is_published = true,
  eligible_countries = array['PK'],
  value_type = 'stipend', value_amount = 992, value_currency = 'EUR',
  value_text = '€992 a month for master''s students (€1,400 for doctoral candidates), plus insurance and a travel allowance, for 12 to 42 months',
  deadline_note = 'Each course sets its own deadline for 2027/28 entry, and some have already closed. Apply directly to up to three courses from the DAAD course list.',
  verified_on = '2026-10-11', confidence = 'medium'
where slug = 'daad-epos-development-related-postgraduate-courses';
