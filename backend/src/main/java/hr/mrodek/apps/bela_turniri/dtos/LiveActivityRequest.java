package hr.mrodek.apps.bela_turniri.dtos;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One Live Activity (iOS) / Live Update (Android) event from the Node game
 * server (game/README.md §3 "Live Activity"). Server-to-server only.
 *
 * <p>{@link State} is the ContentState contract shared by the game server,
 * this relay and the native widgets — the field names are the wire names and
 * must not drift. Validation is SHAPE only, like
 * {@link GameResultReportRequest}: the caller is trusted, and what is checked
 * is what would reach a phone as garbage. Messages stay English — the only
 * reader is the game server's log.
 */
public record LiveActivityRequest(

        @NotBlank(message = "uid is required")
        @Size(max = 128, message = "uid is too long")
        String uid,

        @NotNull(message = "event is required")
        @Pattern(regexp = "^(update|end)$", message = "event must be 'update' or 'end'")
        String event,

        @NotNull(message = "state is required")
        @Valid
        State state,

        @Size(min = 1, max = 512, message = "iosActivityToken must be 1-512 characters")
        String iosActivityToken,

        @Size(min = 1, max = 512, message = "iosPushToStartToken must be 1-512 characters")
        String iosPushToStartToken
) {

    public record State(
            @NotBlank(message = "state.roomId is required")
            @Size(max = 64, message = "state.roomId is too long")
            String roomId,

            @NotNull(message = "state.phase is required")
            @Pattern(regexp = "^(bidding|playing|dealDone|gameOver)$", message = "state.phase is not a known phase")
            String phase,

            @NotNull(message = "state.scoreUs is required")
            Integer scoreUs,

            @NotNull(message = "state.scoreThem is required")
            Integer scoreThem,

            @NotNull(message = "state.target is required")
            @Min(value = 1, message = "state.target must be positive")
            Integer target,

            @NotNull(message = "state.yourTurn is required")
            Boolean yourTurn,

            /** Null between turns. */
            @Min(value = 0, message = "state.turnSeat must be 0-3")
            @Max(value = 3, message = "state.turnSeat must be 0-3")
            Integer turnSeat,

            /** Epoch ms; null when no clock is running. */
            Long turnDeadline,

            /** The engine's Suit, verbatim; null before trump is called. */
            @Pattern(regexp = "^(HERC|KARA|PIK|TREF)$", message = "state.trump is not a suit")
            String trump,

            /** Only meaningful with phase gameOver. */
            @Pattern(regexp = "^(us|them)$", message = "state.winner must be 'us' or 'them'")
            String winner
    ) {}
}
