package hr.mrodek.apps.bela_turniri.services;

import hr.mrodek.apps.bela_turniri.dtos.DrinkPriceDto;
import hr.mrodek.apps.bela_turniri.model.TournamentDrinkPrice;
import hr.mrodek.apps.bela_turniri.model.Tournaments;
import hr.mrodek.apps.bela_turniri.model.UserDrinkTemplate;
import hr.mrodek.apps.bela_turniri.repository.TournamentDrinkPriceRepository;
import hr.mrodek.apps.bela_turniri.repository.UserDrinkTemplateRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Cjenik (drink price list) management — both the per-tournament list and
 * the per-user reusable template. The "save as template" / "import
 * template" buttons on the UI route through here.
 */
@ApplicationScoped
public class CjenikService {

    @Inject TournamentDrinkPriceRepository priceRepo;
    @Inject UserDrinkTemplateRepository templateRepo;

    /* =========================================================
       Per-tournament cjenik
       ========================================================= */

    public List<DrinkPriceDto> listForTournament(Long tournamentId) {
        return priceRepo.findByTournamentId(tournamentId).stream()
                .map(CjenikService::toDto)
                .toList();
    }

    /**
     * Replace the tournament's cjenik with the given items. Existing rows
     * that match by id get updated in place — that way attached match
     * drinks keep their soft FK link. Rows missing from the payload are
     * deleted (which sets their match_drinks.price_id to null via the
     * ON DELETE SET NULL constraint, preserving recorded bills).
     */
    @Transactional
    public List<DrinkPriceDto> replaceTournamentCjenik(Tournaments t, List<DrinkPriceDto> items) {
        Map<Long, TournamentDrinkPrice> existing = new HashMap<>();
        for (var p : priceRepo.findByTournamentId(t.getId())) {
            existing.put(p.getId(), p);
        }

        List<TournamentDrinkPrice> kept = new ArrayList<>();
        int order = 0;
        for (var dto : items) {
            String name = trimToNull(dto.name());
            if (name == null) continue;
            BigDecimal price = dto.price() != null ? dto.price() : BigDecimal.ZERO;
            int sort = dto.sortOrder() != null ? dto.sortOrder() : order++;

            TournamentDrinkPrice row = (dto.id() != null) ? existing.remove(dto.id()) : null;
            if (row == null) {
                row = new TournamentDrinkPrice();
                row.setTournament(t);
            }
            row.setName(name);
            row.setPrice(price);
            row.setSortOrder(sort);
            priceRepo.persist(row);
            kept.add(row);
        }

        // Whatever's left in `existing` was removed by the user — delete it.
        // ON DELETE SET NULL on match_drinks.price_id preserves the
        // snapshot rows; bills don't lose their history.
        for (var orphan : existing.values()) {
            priceRepo.delete(orphan);
        }

        return kept.stream().map(CjenikService::toDto).toList();
    }

    /* =========================================================
       Per-user reusable template
       ========================================================= */

    public List<DrinkPriceDto> listTemplate(String userUid) {
        return templateRepo.findByUserUid(userUid).stream()
                .map(CjenikService::toTemplateDto)
                .toList();
    }

    /**
     * Replace the user's template (full rewrite — keeps no history).
     * Templates have no downstream foreign keys so a wipe-and-recreate
     * is fine.
     */
    @Transactional
    public List<DrinkPriceDto> replaceTemplate(String userUid, List<DrinkPriceDto> items) {
        templateRepo.deleteByUserUid(userUid);
        List<UserDrinkTemplate> kept = new ArrayList<>();
        int order = 0;
        for (var dto : items) {
            String name = trimToNull(dto.name());
            if (name == null) continue;
            BigDecimal price = dto.price() != null ? dto.price() : BigDecimal.ZERO;
            int sort = dto.sortOrder() != null ? dto.sortOrder() : order++;
            var row = new UserDrinkTemplate();
            row.setUserUid(userUid);
            row.setName(name);
            row.setPrice(price);
            row.setSortOrder(sort);
            templateRepo.persist(row);
            kept.add(row);
        }
        return kept.stream().map(CjenikService::toTemplateDto).toList();
    }

    /** Save the current tournament's cjenik to the user's template. */
    @Transactional
    public List<DrinkPriceDto> saveTournamentAsTemplate(Tournaments t, String userUid) {
        var items = priceRepo.findByTournamentId(t.getId()).stream()
                .map(p -> new DrinkPriceDto(null, p.getName(), p.getPrice(), p.getSortOrder()))
                .toList();
        return replaceTemplate(userUid, items);
    }

    /**
     * Import the user's template into a tournament's cjenik (overwrites
     * any existing tournament cjenik). Useful when starting a new
     * tournament at the same venue.
     */
    @Transactional
    public List<DrinkPriceDto> importTemplateIntoTournament(Tournaments t, String userUid) {
        var items = templateRepo.findByUserUid(userUid).stream()
                .map(p -> new DrinkPriceDto(null, p.getName(), p.getPrice(), p.getSortOrder()))
                .toList();
        return replaceTournamentCjenik(t, items);
    }

    /* =========================================================
       Helpers
       ========================================================= */

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static DrinkPriceDto toDto(TournamentDrinkPrice p) {
        return new DrinkPriceDto(p.getId(), p.getName(), p.getPrice(), p.getSortOrder());
    }

    private static DrinkPriceDto toTemplateDto(UserDrinkTemplate p) {
        return new DrinkPriceDto(p.getId(), p.getName(), p.getPrice(), p.getSortOrder());
    }
}
