-- =====================================================================
-- Grätzl — curated POI pins via dedicated system account
--
-- Seeds 20 iconic Vienna landmarks/parks/landscape features as real pins
-- owned by a dedicated editorial account `@graetzl_redaktion`. These pins
-- behave exactly like any other pin: they are clickable, saveable,
-- upvotable, counted in district pin_count_cached, and visible in
-- pins_in_bbox / pins_with_coords queries via existing RLS (is_hidden =
-- false).
--
-- Why a dedicated account (vs nullable author_id):
--   • Zero churn on RLS, fetch logic, types, or display surfaces
--   • Clean attribution: pins show "Von @graetzl_redaktion"
--   • Reversible: ON DELETE CASCADE on author_id purges the seed cleanly
--
-- Idempotency:
--   • System auth user creation is gated on NOT EXISTS
--   • Profile is upserted on conflict(id) — handles the case where the
--     handle_new_user trigger already ran and created a placeholder row
--   • Pin seed is gated on "any pins by system author exist" — re-running
--     this migration after manual edits won't clobber them. To re-seed
--     intentionally, DELETE FROM pins WHERE author_id = '...0001' first.
--
-- Images:
--   Hot-linked from Wikimedia Commons via the Special:FilePath redirector.
--   Each URL resolves to the current canonical file location regardless
--   of moves. License: each image is CC-BY-SA or public domain; on the
--   client side we render with <Image unoptimized> to bypass the Next.js
--   optimiser (no remotePatterns config needed). If any filename has
--   moved or doesn't exist, the pin renders without an image — the
--   pin data itself remains valid.
-- =====================================================================

set search_path = public, extensions, pg_temp;

-- =====================================================================
-- (1) System auth user
--
-- Inserted with a deterministic UUID. encrypted_password is a non-
-- matchable placeholder so login attempts always fail; the account is
-- service-only and never authenticates interactively.
-- =====================================================================
do $$
declare
  v_system_uid uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not exists (select 1 from auth.users where id = v_system_uid) then
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_system_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'system@graetzl.local',
      '$2a$10$NeverUsedForLoginPlaceholderHashCanNotBeVerifiedXY',
      now(),
      jsonb_build_object('provider', 'system', 'providers', jsonb_build_array('system')),
      jsonb_build_object('system', true),
      now(), now()
    );
  end if;
end $$;

-- =====================================================================
-- (2) System profile
--
-- The handle_new_user trigger fires on auth.users INSERT and creates a
-- profiles row with a generated `wiener_<8hex>` handle. Upsert here so
-- the curated handle/bio overrides whatever the trigger produced.
-- =====================================================================
insert into public.profiles (id, handle, bio, home_city, created_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'graetzl_redaktion',
  'Kuratierte Sehenswürdigkeiten, Parks und Landschaftshighlights von Wien. Lokale Pins der Community sitzen darüber.',
  'Vienna',
  now()
)
on conflict (id) do update set
  handle = excluded.handle,
  bio = excluded.bio,
  home_city = excluded.home_city;

-- =====================================================================
-- (3) Pin seed — 20 curated POIs
--
-- Categories used from the public.pins.category CHECK constraint:
--   art_history → built cultural heritage (churches, palaces, museums)
--   view        → towers, viewpoints, water features
--   other       → parks and large public green spaces
--
-- district_id is resolved at insert time via the district_at_point RPC
-- (migration 20260515000007). pin_count_cached on districts is
-- maintained by the trigger from migration 20260515000005, which fires
-- on each INSERT below.
-- =====================================================================
do $$
declare
  v_system_uid uuid := '00000000-0000-0000-0000-000000000001';
begin
  if (select count(*) from public.pins where author_id = v_system_uid) > 0 then
    raise notice 'curated POI pins already seeded; skipping insert';
    return;
  end if;

  insert into public.pins (
    author_id, title, body, category, language,
    location, precision, city, photo_url, district_id
  ) values
    -- ── Landmarks (built cultural heritage) ───────────────────────────
    (v_system_uid, 'Stephansdom',
     'Gotische Kathedrale aus dem 14. Jh., das Wahrzeichen Wiens. Der 137-m-Südturm und das ornamentale Pyrogranit-Dach prägen die Skyline der Inneren Stadt.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3725 48.2086)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wien_-_Stephansdom_%281%29.JPG?width=1200',
     district_at_point(16.3725, 48.2086)),

    (v_system_uid, 'Schloss Schönbrunn',
     'Barocke Sommerresidenz der Habsburger und UNESCO-Welterbe. Schlosspark mit Gloriette, Tiergarten und Palmenhaus.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3122 48.1845)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Schloss_Sch%C3%B6nbrunn.jpg?width=1200',
     district_at_point(16.3122, 48.1845)),

    (v_system_uid, 'Schloss Belvedere',
     'Zwei barocke Schlösser im weitläufigen Garten. Im Oberen Belvedere hängt Klimts „Der Kuss".',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3805 48.1916)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Schloss_Belvedere_Wien.jpg?width=1200',
     district_at_point(16.3805, 48.1916)),

    (v_system_uid, 'Hofburg',
     'Ehemaliger Hauptsitz der Habsburger. Heute Schatzkammer, Spanische Hofreitschule, mehrere Museen und Amtssitz des Bundespräsidenten.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3651 48.2079)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/ETH-BIB-Hofburg%2C_Wien-Weitere-LBS_MH02-30-0012.tif?width=1200',
     district_at_point(16.3651, 48.2079)),

    (v_system_uid, 'Karlskirche',
     'Barocke Kuppelkirche aus dem 18. Jh. Die zwei Säulen vor dem Eingang erinnern an Triumphsäulen Roms.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3719 48.1985)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Karlskirche_Vienna.jpg?width=1200',
     district_at_point(16.3719, 48.1985)),

    (v_system_uid, 'Wiener Staatsoper',
     'Eines der bedeutendsten Opernhäuser der Welt. Rund 300 Vorstellungen pro Saison ohne Pause.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3686 48.2031)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wiener_Staatsoper.jpg?width=1200',
     district_at_point(16.3686, 48.2031)),

    (v_system_uid, 'Hundertwasserhaus',
     'Wohnhaus von Friedensreich Hundertwasser mit krummen Böden, bewachsenen Dächern und keiner einzigen geraden Linie.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3942 48.2076)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Hundertwasserhaus.jpg?width=1200',
     district_at_point(16.3942, 48.2076)),

    (v_system_uid, 'MuseumsQuartier',
     'Eines der größten Kulturareale Europas. Leopold Museum, MUMOK, Kunsthalle, Tanzquartier — und Innenhöfe mit Loungemöbeln.',
     'art_history', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3597 48.2030)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/MuseumsQuartier_Vienna.jpg?width=1200',
     district_at_point(16.3597, 48.2030)),

    -- ── Views (towers, viewpoints, water features) ────────────────────
    (v_system_uid, 'Wiener Riesenrad',
     'Wahrzeichen des Praters seit 1897. Die hölzernen Waggons bieten Blick über die ganze Stadt.',
     'view', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3962 48.2161)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wien_Riesenrad.jpg?width=1200',
     district_at_point(16.3962, 48.2161)),

    (v_system_uid, 'Donauturm',
     '252-m-Aussichtsturm im Donaupark. Restaurant rotiert in 26 Minuten um die eigene Achse.',
     'view', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.4099 48.2406)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Donauturm_Wien.jpg?width=1200',
     district_at_point(16.4099, 48.2406)),

    (v_system_uid, 'Kahlenberg',
     'Aussichtsberg im Wienerwald (484 m). Klassiker-Blick auf Wien und die Weinberge des Nußdorfer Hangs.',
     'view', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3324 48.2731)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Kahlenberg_Wien.jpg?width=1200',
     district_at_point(16.3324, 48.2731)),

    (v_system_uid, 'Donauinsel',
     '21 km langer Streifen zwischen Donau und Neuer Donau. Im Sommer der Strand der Stadt.',
     'view', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.4180 48.2350)'),
     'approximate', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wien_-_Donauinsel_mit_den_Donaubr%C3%BCcken.JPG?width=1200',
     district_at_point(16.4180, 48.2350)),

    (v_system_uid, 'Donaukanal',
     'Stadtkanal der Donau durch die Innenstadt. Streetart-Wände, Sommerbars, durchgehender Radweg von Nußdorf bis zur Mündung.',
     'view', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3786 48.2117)'),
     'approximate', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Donaukanal_Wien.jpg?width=1200',
     district_at_point(16.3786, 48.2117)),

    -- ── Parks (large public green spaces) ─────────────────────────────
    (v_system_uid, 'Stadtpark',
     'Erster öffentlicher Park Wiens (1862). Berühmt für das vergoldete Johann-Strauß-Denkmal.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3796 48.2050)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Vienna_Stadtpark_from_above.jpg?width=1200',
     district_at_point(16.3796, 48.2050)),

    (v_system_uid, 'Volksgarten',
     'Englischer Landschaftsgarten neben der Hofburg. Rosengarten mit über 3.000 Rosen.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3611 48.2079)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wien_-_Volksgarten.JPG?width=1200',
     district_at_point(16.3611, 48.2079)),

    (v_system_uid, 'Burggarten',
     'Ehemaliger Hofgarten der Habsburger. Liegewiese im Zentrum, Mozart-Denkmal und das Schmetterlingshaus.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3667 48.2055)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wien_01_Burggarten_n.jpg?width=1200',
     district_at_point(16.3667, 48.2055)),

    (v_system_uid, 'Augarten',
     'Ältester barocker Garten Wiens (1614). Heimat der Wiener Sängerknaben und der Porzellanmanufaktur.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3756 48.2238)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Augarten_Wien.jpg?width=1200',
     district_at_point(16.3756, 48.2238)),

    (v_system_uid, 'Türkenschanzpark',
     'Großzügiger Landschaftsgarten im 18. Bezirk mit Teich, Pavillon und alten Baumbeständen.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.3416 48.2382)'),
     'exact', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Tuerkenschanzpark_Wiese.jpg?width=1200',
     district_at_point(16.3416, 48.2382)),

    (v_system_uid, 'Lainzer Tiergarten',
     'Großer Waldpark im Wienerwald (24,5 km²). Wildschweine, Mufflons und die Hermesvilla.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.2436 48.1773)'),
     'approximate', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Torw%C3%A4rterhaus_%2875204%29_IMG_1471.jpg?width=1200',
     district_at_point(16.2436, 48.1773)),

    (v_system_uid, 'Prater',
     'Riesiger öffentlicher Park und Volksvergnügen. Wurstelprater mit Riesenrad, Liliputbahn, Hauptallee zum Joggen.',
     'other', 'de',
     ST_GeogFromText('SRID=4326;POINT(16.4030 48.2120)'),
     'approximate', 'Vienna',
     'https://commons.wikimedia.org/wiki/Special:FilePath/Wurstelprater.jpg?width=1200',
     district_at_point(16.4030, 48.2120));
end $$;

-- =====================================================================
-- (4) Reconcile district pin_count_cached
--
-- The B-5 trigger maintains pin_count_cached on individual inserts, but
-- run the admin reconciler once here so any drift from this batch insert
-- is settled before the migration returns.
-- =====================================================================
select public.refresh_district_pin_counts();
