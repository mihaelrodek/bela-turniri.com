-- Legacy import: '1. MEMORIJALNI TURNIR U BELI BENJAMIN BEK'
-- Generated from the original .xlsx. Run as a single transaction.
-- The id columns are populated explicitly via nextval(...) because
-- the entities use Hibernate @SequenceGenerator (no Postgres DEFAULT).
--
-- Rounds 1-5 are the regular-season tables (with byes for Ika in R1,
-- Tomislav Lončarek in R2, Biškup in R5). Rounds 6-8 are the bracket
-- stage decoded from 'Kolo 5':
--   R6 = semifinals (col C pairings)
--   R7 = second-chance / losers'-bracket pairings (col E)
--   R8 = championship final between the two survivors (Biškup 2,
--        Kralj 1) — sourced from the organiser, not from the sheet.
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
        '1-memorijalni-turnir-u-beli-benjamin-bek',
        '1. MEMORIJALNI TURNIR U BELI BENJAMIN BEK',
        NULL,
        'FINISHED',
        29,
        0, 0,
        NOW() - INTERVAL '1 year',
        NULL, NULL,
        'Biškup i Čelig',
        false, false
    );

    -- ───── 2. Pairs ─────
    -- 29 pairs from the 'Parovi' sheet.

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Jurica Vresk i Matija Ivančić',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Jurica Vresk i Matija Ivančić', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Mark Premužić i Valerija Četrtek',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Mark Premužić i Valerija Četrtek', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Marko Perhaj i Mario Galinec',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Marko Perhaj i Mario Galinec', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Miroslav i Ines',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Miroslav i Ines', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Franjo Jurgec i Joco',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Franjo Jurgec i Joco', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Biškup i Čelig',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Biškup i Čelig', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Dalibor Telebar i Božidar Bušnja',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Dalibor Telebar i Božidar Bušnja', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Zrinski i Frankopan',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Zrinski i Frankopan', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Elvis I Stjepan',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Elvis I Stjepan', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Krunoslav Oreški i Matija',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Krunoslav Oreški i Matija', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Dok i Joža',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Dok i Joža', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Ika',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Ika', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Goran Sincek i Vedran Ivancic',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Goran Sincek i Vedran Ivancic', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Dražen Kokot i Žuna Mario',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Dražen Kokot i Žuna Mario', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Tomislav Lončarek i Ivica Zgrebec',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Tomislav Lončarek i Ivica Zgrebec', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Marica i Mitra',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Marica i Mitra', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Silvija i Gabrijel',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Silvija i Gabrijel', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Sanja i Dejan',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Sanja i Dejan', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Em na kvadrat',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Em na kvadrat', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Karlo Kukec i Simona Bunic',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Karlo Kukec i Simona Bunic', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Plahtarić i Šambar',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Plahtarić i Šambar', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Marko i Damir',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Marko i Damir', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Stjepan Đurasek i Domagoj Oštarjaš',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Stjepan Đurasek i Domagoj Oštarjaš', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Varan i Digula',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Varan i Digula', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Samo ne oni',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Samo ne oni', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Jura i Jura',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Jura i Jura', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Bolcevic i Vrabec',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Bolcevic i Vrabec', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Kovačić i Kelemen',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Kovačić i Kelemen', v_pair_id);

    v_pair_id := nextval('seq_pairs_id');
    INSERT INTO pairs (id, tournament_id, name, is_eliminated,
                       extra_life, wins, losses, paid,
                       pending_approval)
    VALUES (v_pair_id, v_tournament_id, 'Kralj i Tomiša',
            false, false, 0, 0, true, false);
    v_pair_ids := v_pair_ids || jsonb_build_object('Kralj i Tomiša', v_pair_id);

    -- ───── 3. Rounds + matches ─────

    -- Round 1 — regular season (15 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 1, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT, (v_pair_ids->>'Goran Sincek i Vedran Ivancic')::BIGINT,
            2, 1, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Dok i Joža')::BIGINT, (v_pair_ids->>'Sanja i Dejan')::BIGINT,
            1, 2, (v_pair_ids->>'Sanja i Dejan')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Marko i Damir')::BIGINT, (v_pair_ids->>'Silvija i Gabrijel')::BIGINT,
            2, 1, (v_pair_ids->>'Marko i Damir')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT, (v_pair_ids->>'Elvis I Stjepan')::BIGINT,
            2, 0, (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Miroslav i Ines')::BIGINT, (v_pair_ids->>'Zrinski i Frankopan')::BIGINT,
            2, 1, (v_pair_ids->>'Miroslav i Ines')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Bolcevic i Vrabec')::BIGINT, (v_pair_ids->>'Jura i Jura')::BIGINT,
            1, 2, (v_pair_ids->>'Jura i Jura')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT, (v_pair_ids->>'Stjepan Đurasek i Domagoj Oštarjaš')::BIGINT,
            2, 1, (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Varan i Digula')::BIGINT, (v_pair_ids->>'Em na kvadrat')::BIGINT,
            2, 1, (v_pair_ids->>'Varan i Digula')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Kralj i Tomiša')::BIGINT, (v_pair_ids->>'Dalibor Telebar i Božidar Bušnja')::BIGINT,
            2, 1, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 10,
            (v_pair_ids->>'Marica i Mitra')::BIGINT, (v_pair_ids->>'Jurica Vresk i Matija Ivančić')::BIGINT,
            0, 2, (v_pair_ids->>'Jurica Vresk i Matija Ivančić')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 11,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Samo ne oni')::BIGINT,
            2, 1, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 12,
            (v_pair_ids->>'Biškup i Čelig')::BIGINT, (v_pair_ids->>'Tomislav Lončarek i Ivica Zgrebec')::BIGINT,
            0, 2, (v_pair_ids->>'Tomislav Lončarek i Ivica Zgrebec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 13,
            (v_pair_ids->>'Plahtarić i Šambar')::BIGINT, (v_pair_ids->>'Mark Premužić i Valerija Četrtek')::BIGINT,
            2, 0, (v_pair_ids->>'Plahtarić i Šambar')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 14,
            (v_pair_ids->>'Ika')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 15,
            (v_pair_ids->>'Kovačić i Kelemen')::BIGINT, (v_pair_ids->>'Karlo Kukec i Simona Bunic')::BIGINT,
            1, 2, (v_pair_ids->>'Karlo Kukec i Simona Bunic')::BIGINT,
            'FINISHED');

    -- Round 2 — regular season (13 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 2, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Dalibor Telebar i Božidar Bušnja')::BIGINT, (v_pair_ids->>'Elvis I Stjepan')::BIGINT,
            2, 0, (v_pair_ids->>'Dalibor Telebar i Božidar Bušnja')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT, (v_pair_ids->>'Sanja i Dejan')::BIGINT,
            2, 1, (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Marko i Damir')::BIGINT,
            2, 1, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Biškup i Čelig')::BIGINT, (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT,
            2, 1, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Karlo Kukec i Simona Bunic')::BIGINT, (v_pair_ids->>'Zrinski i Frankopan')::BIGINT,
            0, 2, (v_pair_ids->>'Zrinski i Frankopan')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Varan i Digula')::BIGINT, (v_pair_ids->>'Jura i Jura')::BIGINT,
            2, 1, (v_pair_ids->>'Varan i Digula')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Silvija i Gabrijel')::BIGINT, (v_pair_ids->>'Ika')::BIGINT,
            2, 1, (v_pair_ids->>'Silvija i Gabrijel')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Bolcevic i Vrabec')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            1, 2, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Samo ne oni')::BIGINT, (v_pair_ids->>'Kovačić i Kelemen')::BIGINT,
            2, 0, (v_pair_ids->>'Samo ne oni')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 10,
            (v_pair_ids->>'Tomislav Lončarek i Ivica Zgrebec')::BIGINT, NULL,
            NULL, NULL, NULL,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 11,
            (v_pair_ids->>'Em na kvadrat')::BIGINT, (v_pair_ids->>'Mark Premužić i Valerija Četrtek')::BIGINT,
            2, 0, (v_pair_ids->>'Em na kvadrat')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 12,
            (v_pair_ids->>'Miroslav i Ines')::BIGINT, (v_pair_ids->>'Jurica Vresk i Matija Ivančić')::BIGINT,
            2, 1, (v_pair_ids->>'Miroslav i Ines')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 13,
            (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT, (v_pair_ids->>'Plahtarić i Šambar')::BIGINT,
            2, 1, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            'FINISHED');

    -- Round 3 — regular season (9 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 3, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Jura i Jura')::BIGINT, (v_pair_ids->>'Silvija i Gabrijel')::BIGINT,
            1, 2, (v_pair_ids->>'Silvija i Gabrijel')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Tomislav Lončarek i Ivica Zgrebec')::BIGINT, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            1, 2, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Samo ne oni')::BIGINT, (v_pair_ids->>'Miroslav i Ines')::BIGINT,
            2, 0, (v_pair_ids->>'Samo ne oni')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Varan i Digula')::BIGINT, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            0, 2, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Zrinski i Frankopan')::BIGINT, (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT,
            1, 2, (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT, (v_pair_ids->>'Em na kvadrat')::BIGINT,
            2, 1, (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 7,
            (v_pair_ids->>'Kralj i Tomiša')::BIGINT, (v_pair_ids->>'Dalibor Telebar i Božidar Bušnja')::BIGINT,
            2, 1, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 8,
            (v_pair_ids->>'Ika')::BIGINT, (v_pair_ids->>'Sanja i Dejan')::BIGINT,
            1, 2, (v_pair_ids->>'Sanja i Dejan')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 9,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Jurica Vresk i Matija Ivančić')::BIGINT,
            2, 0, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    -- Round 4 — regular season (6 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 4, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT, (v_pair_ids->>'Miroslav i Ines')::BIGINT,
            2, 1, (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Tomislav Lončarek i Ivica Zgrebec')::BIGINT, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            0, 2, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Sanja i Dejan')::BIGINT, (v_pair_ids->>'Varan i Digula')::BIGINT,
            0, 2, (v_pair_ids->>'Varan i Digula')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Samo ne oni')::BIGINT, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            0, 2, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 5,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Silvija i Gabrijel')::BIGINT,
            2, 0, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 6,
            (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            1, 2, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    -- Round 5 — quarterfinals (Biškup has a bye at Stol 4) (4 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 5, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Dražen Kokot i Žuna Mario')::BIGINT, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            0, 2, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Varan i Digula')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            0, 2, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 3,
            (v_pair_ids->>'Krunoslav Oreški i Matija')::BIGINT, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            1, 2, (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 4,
            (v_pair_ids->>'Biškup i Čelig')::BIGINT, NULL,
            2, NULL, NULL,
            'FINISHED');

    -- Round 6 — semifinals (decoded from Kolo 5 bracket layout) (2 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 6, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            2, 0, (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            0, 2, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    -- Round 7 — second-chance / losers'-bracket pairings (Kolo 5, col E) (2 matches)
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 7, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Franjo Jurgec i Joco')::BIGINT, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            0, 2, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 2,
            (v_pair_ids->>'Marko Perhaj i Mario Galinec')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            0, 2, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            'FINISHED');

    -- Round 8 — championship final (1 match)
    -- Biškup (winners' bracket champion) vs Kralj (came up through the
    -- second-chance bracket). Reported by the organiser: Biškup 2, Kralj 1.
    v_round_id := nextval('seq_rounds_id');
    INSERT INTO rounds (id, tournament_id, number, status, completed_at)
    VALUES (v_round_id, v_tournament_id, 8, 'COMPLETED', NOW());

    INSERT INTO matches (id, tournament_id, round_id, table_no,
                         pair1_id, pair2_id, score1, score2,
                         winner_pair_id, status)
    VALUES (nextval('seq_matches_id'), v_tournament_id, v_round_id, 1,
            (v_pair_ids->>'Biškup i Čelig')::BIGINT, (v_pair_ids->>'Kralj i Tomiša')::BIGINT,
            2, 1, (v_pair_ids->>'Biškup i Čelig')::BIGINT,
            'FINISHED');

    -- ───── 4. Recompute pair wins/losses from match results ─────
    -- The app keeps Pairs.wins / Pairs.losses denormalised; recompute
    -- them from the inserted matches so the Standings tab shows correct
    -- numbers without going through the API. is_eliminated follows the
    -- 2-strike rule (extra_life would override this in the live tournament,
    -- but for a finished/imported tournament the flag is just historical).
    UPDATE pairs p SET
        wins = sub.wins,
        losses = sub.losses,
        is_eliminated = (sub.losses >= 2)
    FROM (
        SELECT p.id,
            COUNT(*) FILTER (WHERE m.winner_pair_id = p.id) AS wins,
            COUNT(*) FILTER (
                WHERE m.winner_pair_id IS NOT NULL
                  AND m.winner_pair_id <> p.id
                  AND (m.pair1_id = p.id OR m.pair2_id = p.id)
            ) AS losses
        FROM pairs p
        LEFT JOIN matches m
          ON (m.pair1_id = p.id OR m.pair2_id = p.id)
        WHERE p.tournament_id = v_tournament_id
        GROUP BY p.id
    ) sub
    WHERE p.id = sub.id AND p.tournament_id = v_tournament_id;

    RAISE NOTICE 'Imported tournament % with % pairs.',
        v_tournament_id, (SELECT COUNT(*) FROM jsonb_object_keys(v_pair_ids));
END
$$;

COMMIT;
