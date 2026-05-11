package hr.mrodek.apps.bela_turniri.repository;

import hr.mrodek.apps.bela_turniri.model.UserDrinkTemplate;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;

@ApplicationScoped
public class UserDrinkTemplateRepository implements PanacheRepository<UserDrinkTemplate> {

    public List<UserDrinkTemplate> findByUserUid(String uid) {
        return list("userUid = ?1 order by sortOrder, id", uid);
    }

    public long deleteByUserUid(String uid) {
        return delete("userUid", uid);
    }
}
