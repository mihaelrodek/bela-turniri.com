package hr.mrodek.apps.bela_turniri.enums;

/**
 * How an admin closed a report. Two outcomes is the whole vocabulary the
 * operator needs to answer "what did you do about it": either the content was
 * fine ({@link #DISMISSED}) or something was done about it ({@link #ACTIONED}).
 * WHAT was done lives in the free-text {@code adminNote} — encoding every
 * possible action as an enum value would mean a migration per new moderation
 * tool.
 */
public enum ReportResolution {
    DISMISSED,
    ACTIONED
}
