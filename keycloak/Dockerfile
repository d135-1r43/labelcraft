# Keycloak for Labeleur: the email allowlist provider, the login theme and
# the realm, which is imported on first start.

FROM maven:3.9.16-eclipse-temurin-21 AS extension
WORKDIR /build
COPY extension/pom.xml .
RUN mvn -q -B dependency:go-offline
COPY extension/src src
RUN mvn -q -B package

FROM quay.io/keycloak/keycloak:26.7.5 AS builder
COPY --from=extension /build/target/labeleur-keycloak.jar /opt/keycloak/providers/
COPY themes/labeleur /opt/keycloak/themes/labeleur
ENV KC_DB=postgres KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.7.5
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm/labeleur-realm.json /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
