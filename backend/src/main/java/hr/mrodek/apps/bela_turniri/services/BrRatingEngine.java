package hr.mrodek.apps.bela_turniri.services;

import com.pocketcombats.openskill.Adjudicator;
import com.pocketcombats.openskill.RatingModelConfig;
import com.pocketcombats.openskill.aggregate.DefaultTeamRatingAggregator;
import com.pocketcombats.openskill.data.RatingAdjustment;
import com.pocketcombats.openskill.data.SimplePlayerResult;
import com.pocketcombats.openskill.data.SimpleTeamResult;
import com.pocketcombats.openskill.model.PlackettLuce;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Versioned OpenSkill 2v2; outcome only, equal weights, no card/score-margin bonuses. */
@ApplicationScoped
public class BrRatingEngine {
    public static final String VERSION = "openskill-java-1.1-plackett-luce-br-v1";
    public static final double INITIAL_MU = 25.0;
    public static final double INITIAL_SIGMA = 25.0 / 3.0;
    public static final int CALIBRATION_GAMES = 20;
    private final RatingModelConfig config = RatingModelConfig.builder()
            .setBeta(25.0 / 6.0).setTau(25.0 / 300.0).setKappa(0.0001)
            .setLimitSigma(false).setBalance(false).build();

    public record Player(String uid, String team, double mu, double sigma) {}

    public Map<String, RatingAdjustment<String>> rate(List<Player> players, String winner) {
        var aggregator = new DefaultTeamRatingAggregator(config);
        var teams = List.of("A", "B").stream().map(team -> {
            var members = players.stream().filter(p -> team.equals(p.team()))
                    .map(p -> new SimplePlayerResult<>(p.uid(), p.mu(), p.sigma())).toList();
            var aggregate = aggregator.computeTeamRating(members);
            return new SimpleTeamResult<>(aggregate.mu(), aggregate.sigma(),
                    team.equals(winner) ? 1 : 2, members);
        }).toList();
        var adjustments = new Adjudicator<String>(config, new PlackettLuce(config)).rate(teams);
        for (var change : adjustments) {
            if (!Double.isFinite(change.mu()) || !Double.isFinite(change.sigma()) || change.sigma() <= 0) {
                throw new IllegalStateException("Non-finite BR adjustment");
            }
        }
        return adjustments.stream().collect(Collectors.toMap(RatingAdjustment::playerId, Function.identity()));
    }

    /** Conservative estimate. During calibration it may rise even after a loss as uncertainty shrinks. */
    public static int display(double mu, double sigma) {
        return (int) Math.max(0, Math.min(Integer.MAX_VALUE, Math.round(1000 + 40 * (mu - 3 * sigma))));
    }

    /** Titles follow the active population; no arbitrary permanent thresholds before launch. */
    public static String title(long place, long population, int games) {
        if (games < CALIBRATION_GAMES) return "CALIBRATING";
        if (place <= 0 || population < 20) return "PLAYER";
        double percentile = (double) place / population;
        if (percentile <= 0.01) return "LEGEND";
        if (percentile <= 0.05) return "GRANDMASTER";
        if (percentile <= 0.20) return "MASTER";
        if (percentile <= 0.50) return "EXPERIENCED";
        return "PLAYER";
    }
}
