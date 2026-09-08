package hr.mrodek.apps.bela_turniri.dtos;

import java.util.List;

/**
 * The declarations ({@code zvanja}) each side announced in one deal, kept as
 * individual values rather than a sum: the profile renders them the way the
 * blok does, "20 + 50", which a total would have destroyed.
 *
 * <p>{@code BLOK-HISTORY.md} §2.3: {@code { "us": [20, 50], "them": [] }}.
 * Never null after normalisation — an absent list is stored as an empty one.
 */
public record BlokDeclarationsDto(List<Integer> us, List<Integer> them) {}
