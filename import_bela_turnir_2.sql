-- Legacy import: '2. Bela turnir'
-- Generated from the original .xlsx. Run as a single transaction.
-- The id columns are populated explicitly via nextval(...) because
-- the entities use Hibernate @SequenceGenerator (no Postgres DEFAULT).
--
-- 27 pairs, 6 rounds played. The tournament was still in progress when
-- this spreadsheet was last saved — Tim Pavlek and Mlade Nade are
-- undefeated, Benko i Martić and Kralj i Stana each lost once and
-- bought a repassage. Imported with status='STARTED' so the organiser
-- can continue running the remaining rounds inside the app.
--
-- Re-running this script inserts a second copy — clean up any prior
-- import first if you need to retry.

BEGIN;

DO $$
DECLARE
    v_tournament_id BIGINT;
    v_round_id      BIGINT;
    v_pair_id       BIGINT;
    v_pair_ids      JSONB := '{}'::JSONB;
BEGIN
    -- ───── 1. Tournament header ─────
    v_tournament_id := nextval('seq_tournaments_id');
    INSERT INTO tournaments (
        id, uuid, slug, name, location, status, max_pairs,
        entry_price, repassage_price, start_at,
        created_by_uid, created_by_name,
        winner_name, preserve_matchmaking, is_deleted
    ) VALUES (
        v_tournament_id,
        gen_random_uuid(),
        '2-bela-turnir',
        '2. Bela turnir',
        NULL,
        'STARTED',
        27,
        0, 0,
        NOW() - INTERVAL '6 months',
        NULL, NULL,
        NULL, false, false
    );

    -- ───── 2. Pairs ─────
    -- 27 pairs from the 'Parovi' sheet. Wins are counted from the
    -- match data; eliminated / extra_life flags come from the
    -- Parovi sheet's lost1/life/lost2 columns.

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Mile i Saša',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Mile i Saša', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Predrag i Sklepa',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Predrag i Sklepa', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, '20 do asa',
            true, true, 3, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('20 do asa', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Franjo i Josip',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Franjo i Josip', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Denis i Luka',
            true, true, 3, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Denis i Luka', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Školski',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Školski', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Benko i Martić',
            false, true, 4, 1, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Benko i Martić', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Matuza i Anđel',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Matuza i Anđel', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Husnjak i Hojsak',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Husnjak i Hojsak', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Perhaj i Galinec',
            true, true, 4, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Perhaj i Galinec', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Tim Pavlek',
            false, false, 5, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Tim Pavlek', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Mlade Nade',
            false, false, 6, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Mlade Nade', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Kralj i Stana',
            false, true, 3, 1, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Kralj i Stana', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Kelemen i Križmanić',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Kelemen i Križmanić', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Slavac i andrea',
            true, true, 2, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Slavac i andrea', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Bara i jere',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Bara i jere', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Puce z Voće',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Puce z Voće', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Trbuha i Horvat',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Trbuha i Horvat', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Jelena i Antonija',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Jelena i Antonija', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Zdravko i zeljko kranjcec',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Zdravko i zeljko kranjcec', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Robi i digi',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Robi i digi', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Galinec i Kolar',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Galinec i Kolar', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Gašo i Miro',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Gašo i Miro', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Čelig i Biškup',
            true, true, 0, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Čelig i Biškup', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Galinec i Svržnjak',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Galinec i Svržnjak', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Jura i Martin',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Jura i Martin', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Sajko i jura',
            true, true, 1, 2, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Sajko i jura', v_pair_id);

    -- ───── Round 1 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 1, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Robi i digi')::BIGINT, (v_pair_ids->>'Puce z Voće')::BIGINT,
            2, 0, (v_pair_ids->>'Robi i digi')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Perhaj i Galinec')::BIGINT, (v_pair_ids->>'Trbuha i Horvat')::BIGINT,
            2, 0, (v_pair_ids->>'Perhaj i Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Zdravko i zeljko kranjcec')::BIGINT, (v_pair_ids->>'Kralj i Stana')::BIGINT,
            0, 2, (v_pair_ids->>'Kralj i Stana')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Sajko i jura')::BIGINT, (v_pair_ids->>'Školski')::BIGINT,
            0, 2, (v_pair_ids->>'Školski')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Denis i Luka')::BIGINT, (v_pair_ids->>'Franjo i Josip')::BIGINT,
            2, 1, (v_pair_ids->>'Denis i Luka')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Gašo i Miro')::BIGINT, (v_pair_ids->>'Jelena i Antonija')::BIGINT,
            1, 2, (v_pair_ids->>'Jelena i Antonija')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Mlade Nade')::BIGINT, (v_pair_ids->>'Jura i Martin')::BIGINT,
            2, 1, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Slavac i andrea')::BIGINT, (v_pair_ids->>'Kelemen i Križmanić')::BIGINT,
            2, 0, (v_pair_ids->>'Slavac i andrea')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Matuza i Anđel')::BIGINT, (v_pair_ids->>'20 do asa')::BIGINT,
            2, 0, (v_pair_ids->>'Matuza i Anđel')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 10,
            (v_pair_ids->>'Benko i Martić')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 11,
            (v_pair_ids->>'Galinec i Svržnjak')::BIGINT, (v_pair_ids->>'Čelig i Biškup')::BIGINT,
            2, 0, (v_pair_ids->>'Galinec i Svržnjak')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 12,
            (v_pair_ids->>'Galinec i Kolar')::BIGINT, (v_pair_ids->>'Husnjak i Hojsak')::BIGINT,
            0, 2, (v_pair_ids->>'Husnjak i Hojsak')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 13,
            (v_pair_ids->>'Bara i jere')::BIGINT, (v_pair_ids->>'Predrag i Sklepa')::BIGINT,
            0, 2, (v_pair_ids->>'Predrag i Sklepa')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 14,
            (v_pair_ids->>'Mile i Saša')::BIGINT, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            0, 2, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            'FINISHED');

    -- ───── Round 2 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 2, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Perhaj i Galinec')::BIGINT, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            0, 2, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Puce z Voće')::BIGINT, (v_pair_ids->>'Mlade Nade')::BIGINT,
            1, 2, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'20 do asa')::BIGINT, (v_pair_ids->>'Galinec i Kolar')::BIGINT,
            2, 0, (v_pair_ids->>'20 do asa')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Slavac i andrea')::BIGINT, (v_pair_ids->>'Franjo i Josip')::BIGINT,
            0, 2, (v_pair_ids->>'Franjo i Josip')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Kelemen i Križmanić')::BIGINT, (v_pair_ids->>'Predrag i Sklepa')::BIGINT,
            2, 1, (v_pair_ids->>'Kelemen i Križmanić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Denis i Luka')::BIGINT, (v_pair_ids->>'Bara i jere')::BIGINT,
            2, 0, (v_pair_ids->>'Denis i Luka')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Robi i digi')::BIGINT, (v_pair_ids->>'Sajko i jura')::BIGINT,
            1, 2, (v_pair_ids->>'Sajko i jura')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Mile i Saša')::BIGINT, (v_pair_ids->>'Jelena i Antonija')::BIGINT,
            2, 0, (v_pair_ids->>'Mile i Saša')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Matuza i Anđel')::BIGINT, (v_pair_ids->>'Gašo i Miro')::BIGINT,
            0, 2, (v_pair_ids->>'Gašo i Miro')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 10,
            (v_pair_ids->>'Jura i Martin')::BIGINT, (v_pair_ids->>'Zdravko i zeljko kranjcec')::BIGINT,
            2, 0, (v_pair_ids->>'Jura i Martin')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 11,
            (v_pair_ids->>'Husnjak i Hojsak')::BIGINT, (v_pair_ids->>'Čelig i Biškup')::BIGINT,
            2, 1, (v_pair_ids->>'Husnjak i Hojsak')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 12,
            (v_pair_ids->>'Školski')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 13,
            (v_pair_ids->>'Kralj i Stana')::BIGINT, (v_pair_ids->>'Galinec i Svržnjak')::BIGINT,
            2, 0, (v_pair_ids->>'Kralj i Stana')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 14,
            (v_pair_ids->>'Trbuha i Horvat')::BIGINT, (v_pair_ids->>'Benko i Martić')::BIGINT,
            0, 2, (v_pair_ids->>'Benko i Martić')::BIGINT,
            'FINISHED');

    -- ───── Round 3 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 3, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Kralj i Stana')::BIGINT, (v_pair_ids->>'Perhaj i Galinec')::BIGINT,
            0, 2, (v_pair_ids->>'Perhaj i Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Robi i digi')::BIGINT, (v_pair_ids->>'Slavac i andrea')::BIGINT,
            0, 2, (v_pair_ids->>'Slavac i andrea')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Husnjak i Hojsak')::BIGINT, (v_pair_ids->>'Predrag i Sklepa')::BIGINT,
            1, 2, (v_pair_ids->>'Predrag i Sklepa')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Školski')::BIGINT, (v_pair_ids->>'Denis i Luka')::BIGINT,
            0, 2, (v_pair_ids->>'Denis i Luka')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Benko i Martić')::BIGINT, (v_pair_ids->>'20 do asa')::BIGINT,
            0, 2, (v_pair_ids->>'20 do asa')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Mile i Saša')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Franjo i Josip')::BIGINT, (v_pair_ids->>'Jelena i Antonija')::BIGINT,
            2, 0, (v_pair_ids->>'Franjo i Josip')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Mlade Nade')::BIGINT, (v_pair_ids->>'Galinec i Svržnjak')::BIGINT,
            2, 1, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Matuza i Anđel')::BIGINT, (v_pair_ids->>'Jura i Martin')::BIGINT,
            2, 1, (v_pair_ids->>'Matuza i Anđel')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 10,
            (v_pair_ids->>'Kelemen i Križmanić')::BIGINT, (v_pair_ids->>'Gašo i Miro')::BIGINT,
            2, 0, (v_pair_ids->>'Kelemen i Križmanić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 11,
            (v_pair_ids->>'Sajko i jura')::BIGINT, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            1, 2, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            'FINISHED');

    -- ───── Round 4 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 4, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Predrag i Sklepa')::BIGINT, (v_pair_ids->>'Školski')::BIGINT,
            0, 2, (v_pair_ids->>'Školski')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Perhaj i Galinec')::BIGINT, (v_pair_ids->>'Matuza i Anđel')::BIGINT,
            2, 0, (v_pair_ids->>'Perhaj i Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Tim Pavlek')::BIGINT, (v_pair_ids->>'Franjo i Josip')::BIGINT,
            2, 1, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Kelemen i Križmanić')::BIGINT, (v_pair_ids->>'20 do asa')::BIGINT,
            1, 2, (v_pair_ids->>'20 do asa')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Slavac i andrea')::BIGINT, (v_pair_ids->>'Benko i Martić')::BIGINT,
            1, 2, (v_pair_ids->>'Benko i Martić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Denis i Luka')::BIGINT, (v_pair_ids->>'Mlade Nade')::BIGINT,
            0, 2, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Kralj i Stana')::BIGINT, (v_pair_ids->>'Mile i Saša')::BIGINT,
            2, 0, (v_pair_ids->>'Kralj i Stana')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Husnjak i Hojsak')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    -- ───── Round 5 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 5, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Mlade Nade')::BIGINT, (v_pair_ids->>'Školski')::BIGINT,
            2, 0, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Kralj i Stana')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'20 do asa')::BIGINT, (v_pair_ids->>'Benko i Martić')::BIGINT,
            1, 2, (v_pair_ids->>'Benko i Martić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Perhaj i Galinec')::BIGINT, (v_pair_ids->>'Husnjak i Hojsak')::BIGINT,
            2, 1, (v_pair_ids->>'Perhaj i Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Tim Pavlek')::BIGINT, (v_pair_ids->>'Denis i Luka')::BIGINT,
            2, 0, (v_pair_ids->>'Tim Pavlek')::BIGINT,
            'FINISHED');

    -- ───── Round 6 ─────
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 6, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Perhaj i Galinec')::BIGINT, (v_pair_ids->>'Benko i Martić')::BIGINT,
            1, 2, (v_pair_ids->>'Benko i Martić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Tim Pavlek')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Mlade Nade')::BIGINT, (v_pair_ids->>'Kralj i Stana')::BIGINT,
            2, 1, (v_pair_ids->>'Mlade Nade')::BIGINT,
            'FINISHED');

END $$;

COMMIT;

