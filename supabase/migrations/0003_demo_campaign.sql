-- Migration 0003: Seed a 10-room demo campaign "La Cripta dei Sussurri"
--
-- Scope: populates campaigns and rooms tables with a playable demo story.
-- Source of truth: docs/Talebound_Architettura_completa.md section 19.

-- ---------------------------------------------------------------------------
-- 1. Insert Campaign
-- ---------------------------------------------------------------------------
INSERT INTO campaigns (
  id,
  author_id,
  author_name,
  title,
  synopsis,
  status,
  languages,
  tags,
  rating_avg,
  rating_count
) VALUES (
  'c1111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'Talebound Team',
  'La Cripta dei Sussurri',
  'Ti addentri nelle profondità di un''antica cripta dimenticata, dove i sussurri del passato minacciano di consumare la tua sanità mentale.',
  'published',
  ARRAY['it'],
  ARRAY['horror', 'mistero', 'esplorazione'],
  0.0,
  0
) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Insert Rooms
-- ---------------------------------------------------------------------------

-- Room 1: Ingresso della Cripta (room-start)
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'c1111111-1111-1111-1111-111111111111',
  'Ingresso della Cripta',
  'Sei in piedi all''ingresso di una fredda cripta di pietra grigia. Una debole luce filtra dall''esterno, illuminando ragnatele ed edera secca. Un pesante portone di legno alle tue spalle è sbarrato dall''esterno. L''unico percorso prosegue verso nord, addentrandosi nell''oscurità.',
  NULL,
  '{"nord": "22222222-2222-2222-2222-222222222222"}'::jsonb,
  'mystery',
  '[]'::jsonb,
  'L''odore di umidità e polvere ti riempie i polmoni mentre i sussurri iniziano a farsi sentire.',
  ARRAY['safe_room']
) ON CONFLICT (id) DO NOTHING;

-- Room 2: Salone dei Sarcofagi
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'c1111111-1111-1111-1111-111111111111',
  'Salone dei Sarcofagi',
  'Un vasto salone rettangolare circondato da antichi sarcofagi di pietra allineati contro le pareti. Alcuni coperchi sono leggermente scostati, rivelando solo oscurità all''interno. La stanza si dirama in quattro direzioni: a sud torni all''ingresso, a ovest c''è una porta di legno marcio, a est c''è un''armeria polverosa, e a nord vedi un bagliore di candele provenienti da un altare.',
  NULL,
  '{"sud": "11111111-1111-1111-1111-111111111111", "ovest": "33333333-3333-3333-3333-333333333333", "est": "55555555-5555-5555-5555-555555555555", "nord": "77777777-7777-7777-7777-777777777777"}'::jsonb,
  'tense',
  '["torcia_spenta"]'::jsonb,
  NULL,
  ARRAY['puzzle']
) ON CONFLICT (id) DO NOTHING;

-- Room 3: Scriptorium Dimenticato
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '33333333-3333-3333-3333-333333333333',
  'c1111111-1111-1111-1111-111111111111',
  'Scriptorium Dimenticato',
  'Gli scaffali di legno che ricoprono le pareti sono colmi di tomi e pergamene consumate dal tempo. Un vecchio tavolo da scrittura siede al centro, coperto da un sottile strato di polvere. Una porta a nord conduce a un laboratorio alchemico, mentre a est si torna al salone principale.',
  NULL,
  '{"est": "22222222-2222-2222-2222-222222222222", "nord": "44444444-4444-4444-4444-444444444444"}'::jsonb,
  'calm',
  '["diario_vecchio"]'::jsonb,
  NULL,
  ARRAY['lore']
) ON CONFLICT (id) DO NOTHING;

-- Room 4: Laboratorio Alchemico
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '44444444-4444-4444-4444-444444444444',
  'c1111111-1111-1111-1111-111111111111',
  'Laboratorio Alchemico',
  'Tavoli da lavoro ingombri di alambicchi, boccette di vetro rotte e residui di sostanze chimiche ormai secche. C''è un forte odore di zolfo nell''aria. L''unica uscita è a sud, verso lo Scriptorium.',
  NULL,
  '{"sud": "33333333-3333-3333-3333-333333333333"}'::jsonb,
  'mystery',
  '["pozione_curativa", "chiave_di_ferro"]'::jsonb,
  NULL,
  ARRAY['loot']
) ON CONFLICT (id) DO NOTHING;

-- Room 5: Armeria Arrugginita
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '55555555-5555-5555-5555-555555555555',
  'c1111111-1111-1111-1111-111111111111',
  'Armeria Arrugginita',
  'Rastrelliere per armi ormai vuote o piene di spade e scudi arrugginiti e inutilizzabili. Pezzi di armature giacciono sparsi sul pavimento di pietra. Una scala a nord conduce giù verso le celle delle prigioni, mentre a ovest torni al salone dei sarcofagi.',
  NULL,
  '{"ovest": "22222222-2222-2222-2222-222222222222", "nord": "66666666-6666-6666-6666-666666666666"}'::jsonb,
  'tense',
  '["daga_arrugginita"]'::jsonb,
  NULL,
  ARRAY['loot']
) ON CONFLICT (id) DO NOTHING;

-- Room 6: Celle Sotterranee
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '66666666-6666-6666-6666-666666666666',
  'c1111111-1111-1111-1111-111111111111',
  'Celle Sotterranee',
  'Un corridoio buio fiancheggiato da celle con sbarre di ferro arrugginite. L''eco di gocce d''acqua che cadono risuona nell''aria fredda. Una delle celle ha la grata accostata. La scala a sud conduce all''armeria.',
  NULL,
  '{"sud": "55555555-5555-5555-5555-555555555555"}'::jsonb,
  'danger',
  '["medaglione_antico"]'::jsonb,
  'Senti una presenza che ti osserva dalle ombre delle celle.',
  ARRAY['danger_zone']
) ON CONFLICT (id) DO NOTHING;

-- Room 7: Santuario Profanato
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  'c1111111-1111-1111-1111-111111111111',
  'Santuario Profanato',
  'Un altare di pietra nera spezzato a metà si trova di fronte a te. Candele ormai spente sono disposte in cerchio sul pavimento. Un pesante portone di bronzo a nord conduce alla camera del tesoro, ma è chiuso a chiave. Un passaggio a est conduce a un chiostro esterno, mentre a sud torni al salone principale.',
  NULL,
  '{"sud": "22222222-2222-2222-2222-222222222222", "nord": "99999999-9999-9999-9999-999999999999", "est": "88888888-8888-8888-8888-888888888888"}'::jsonb,
  'mystery',
  '[]'::jsonb,
  NULL,
  ARRAY['puzzle']
) ON CONFLICT (id) DO NOTHING;

-- Room 8: Chiostro dei Sussurri
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '88888888-8888-8888-8888-888888888888',
  'c1111111-1111-1111-1111-111111111111',
  'Chiostro dei Sussurri',
  'Un piccolo cortile interno a cielo aperto, invaso da rampicanti e fiori notturni che emanano un profumo dolciastro. Da qui puoi vedere la luna sopra di te, ma le pareti sono troppo alte per arrampicarsi. L''unico passaggio a ovest conduce all''altare.',
  NULL,
  '{"ovest": "77777777-7777-7777-7777-777777777777"}'::jsonb,
  'calm',
  '["chiave_di_bronzo"]'::jsonb,
  'L''aria fresca ti dona un attimo di tregua, ma i sussurri persistono nel vento.',
  ARRAY['safe_room']
) ON CONFLICT (id) DO NOTHING;

-- Room 9: Camera del Tesoro
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  '99999999-9999-9999-9999-999999999999',
  'c1111111-1111-1111-1111-111111111111',
  'Camera del Tesoro',
  'Una stanza piena di forzieri aperti e monete d''oro sparse sul pavimento, coperte di polvere. Al centro siede un piedistallo di pietra con una scatola dorata intarsiata di rune. A nord vedi una fessura stretta che conduce a una tomba segreta, mentre a sud torni all''altare.',
  NULL,
  '{"sud": "77777777-7777-7777-7777-777777777777", "nord": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}'::jsonb,
  'victory',
  '["scatola_delle_rune"]'::jsonb,
  'Il luccichio dell''oro contrasta con l''oscurità della cripta.',
  ARRAY['loot']
) ON CONFLICT (id) DO NOTHING;

-- Room 10: Tomba dell'Eretico
INSERT INTO rooms (
  id,
  campaign_id,
  name,
  description_canonical,
  description_state_override,
  connections,
  music_mood,
  items_initial,
  first_visit_text,
  tags
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'c1111111-1111-1111-1111-111111111111',
  'Tomba dell''Eretico',
  'Una piccola cella buia contenente un unico sarcofago ricoperto di catene di ferro nere. L''aria è gelida e i sussurri si fanno assordanti. Qui risiede la fonte della malesistenza. L''unico ritorno è a sud verso la camera del tesoro.',
  NULL,
  '{"sud": "99999999-9999-9999-9999-999999999999"}'::jsonb,
  'sad',
  '[]'::jsonb,
  'I sussurri ti parlano nella mente: hai raggiunto il cuore del mistero.',
  ARRAY['boss_area']
) ON CONFLICT (id) DO NOTHING;
