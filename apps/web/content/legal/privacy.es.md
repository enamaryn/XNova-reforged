# Política de privacidad

Última actualización: 27 de octubre de 2026. Este documento explica qué datos recoge este servidor de XNova Reforged, para qué, durante cuánto tiempo y cómo ejercer sus derechos.

## 1. Responsable del tratamiento

**{{OPERATOR}}** explota este servidor y decide qué datos se recogen. Contacto para cualquier pregunta o solicitud: **{{CONTACT}}**.

## 2. Datos recogidos

| Dato | Finalidad | Conservación |
|---|---|---|
| Nombre de jugador | Identificación en el juego, clasificaciones, mensajes, galaxia (visible para los demás jugadores) | Mientras exista la cuenta |
| Dirección de correo (y su forma canónica: sin alias «+etiqueta» ni puntos de Gmail) | Inicio de sesión, confirmación de la cuenta, contraseña olvidada, detección de cuentas múltiples | Mientras exista la cuenta |
| Contraseña | Inicio de sesión. Solo se guarda una **huella Argon2**, nunca la contraseña | Mientras exista la cuenta |
| Dirección IP (IPv4, o prefijo /64 en IPv6), vista al registrarse, al iniciar sesión y al renovar la sesión | Control de cuentas múltiples y seguridad | **90 días** tras la última observación por defecto (ajustable por el editor), purga automática cada noche |
| Datos de juego: planetas, edificios, investigaciones, flotas, informes, mensajes privados, alianza, misiones, mercado | Funcionamiento del juego | Mientras exista la cuenta |
| Sesiones: huella del token de renovación, fechas | Mantener la sesión abierta y poder revocarla | 30 días como máximo por sesión |
| Tokens de correo (solo la huella) | Confirmación de dirección, restablecimiento de contraseña | Hasta que caducan |
| Incidentes técnicos: errores del servidor, con contraseñas, tokens, cookies, correos y mensajes privados enmascarados | Mantenimiento y seguridad | 30 días por defecto (ajustable por el editor) |
| Diario de auditoría de las acciones de administración | Responsabilidad de los administradores | Mientras sea necesario |

Ningún dato se vende ni se usa para publicidad o elaboración de perfiles. El sitio no utiliza ninguna herramienta de medición de audiencia.

## 3. Bases jurídicas

Ejecución del servicio que usted solicita (cuenta, juego, correos de servicio); interés legítimo del editor en proteger el servicio y hacer respetar la regla «una cuenta por persona» (direcciones IP y correo canónico).

## 4. Destinatarios

Sus datos son accesibles al editor y a los administradores designados. Los correos de servicio pasan por el servidor de envío (SMTP) que elige el editor. Si el editor activa el seguimiento externo de errores **Sentry** (opcional, desactivado por defecto), los informes de error enmascarados se transmiten a ese proveedor, que puede tratarlos fuera de la Unión Europea.

## 5. Cookies y almacenamiento del navegador

El sitio solo usa elementos **necesarios para su funcionamiento**, sin seguimiento publicitario:

- `xnova_access`: cookie de sesión (token de acceso);
- `NEXT_LOCALE`: cookie que recuerda su idioma (un año);
- almacenamiento local del navegador: `xnova-auth` (estado de la sesión) y `xnova-planet` (planeta seleccionado).

Cerrar sesión elimina la cookie de sesión.

## 6. Sus derechos

Puede solicitar el **acceso** a sus datos, su **rectificación**, su **supresión**, su **portabilidad**, o **oponerse** a su tratamiento, escribiendo a **{{CONTACT}}**. Todavía no existe un botón para eliminar la cuenta: el editor atiende la solicitud y elimina la cuenta y sus datos de juego, salvo lo que la ley obligue a conservar. También puede presentar una reclamación ante la autoridad de protección de datos de su país.

## 7. Seguridad

Contraseñas con hash (Argon2), sesiones revocables, tokens guardados como huellas, secretos de configuración cifrados en reposo. Ningún sistema es infalible: comunique cualquier fallo a **{{CONTACT}}**.

## 8. Modificaciones

Esta política puede cambiar; la fecha anterior se actualiza entonces. Las [condiciones de uso](/{{LOCALE}}/terms) complementan este documento.
