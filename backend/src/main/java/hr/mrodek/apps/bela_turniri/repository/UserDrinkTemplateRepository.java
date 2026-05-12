package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.UserDrinkTemplate;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class UserDrinkTemplateRepository implements PanacheRepository<UserDrinkTemplate> {

    /** All items for a user, regardless of which named template they're in. */
    public List<UserDrinkTemplate> findByUserUid(String uid) {
        return list("userUid = ?1 order by templateName, sortOrder, id", uid);
    }

    /** Items belonging to one named template. */
    public List<UserDrinkTemplate> findByUserUidAndTemplateName(String uid, String templateName) {
        return list(
                "userUid = ?1 and templateName = ?2 order by sortOrder, id",
                uid, templateName);
    }

    /** Distinct template names this user has saved, alphabetical. */
    public List<String> listTemplateNames(String uid) {
        return getEntityManager()
                .createQuery(
                        "select distinct t.templateName from UserDrinkTemplate t " +
                        "where t.userUid = ?1 order by t.templateName",
                        String.class)
                .setParameter(1, uid)
                .getResultList();
    }

    public long deleteByUserUidAndTemplateName(String uid, String templateName) {
        return delete("userUid = ?1 and templateName = ?2", uid, templateName);
    }

    /** Bulk-rename used by the "rename template" endpoint. */
    public long renameTemplate(String uid, String oldName, String newName) {
        return update(
                "templateName = ?1 where userUid = ?2 and templateName = ?3",
                newName, uid, oldName);
    }

    public boolean exists(String uid, String templateName) {
        return count("userUid = ?1 and templateName = ?2", uid, templateName) > 0;
    }
}
