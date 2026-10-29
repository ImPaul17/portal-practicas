# PhoneGest · Portal de prácticas

Portal local para registrar las prácticas de empresa entre el **5 de octubre y el 18 de diciembre de 2026**.

## Flujo

- **Inicio** reúne bienvenida, próximo día, contadores, horas, AF trabajadas y actividad reciente.
- **Abrir día** muestra las jornadas laborables disponibles. Cada fecha se abre en una página propia, sin desplegables.
- Al guardar una jornada, aparece en **Días abiertos** dentro del menú lateral. El menú no lista fechas que todavía no hayas creado.
- Desde la página de una jornada puedes editar GitLab, iPasen, horario, AF y etiquetas.
- **Cerrar día** bloquea el registro y actualiza el progreso. Puedes **Reabrir día** para corregirlo.
- **Calendario** es interactivo: haz clic en cualquier día laborable para abrir su página.
- **Resumen** muestra días restantes, jornadas cerradas y cobertura AF8–AF13.

## Datos

Los registros se guardan en `localStorage` del navegador. En **Ajustes** puedes cambiar el nombre y el horario habitual, exportar una copia JSON o importar datos guardados anteriormente.

El botón **Enviar a Séneca** mantiene el puente de mensajes que utiliza la extensión de la carpeta `extension`.

## Desarrollo

La interfaz usa React 18 cargado desde CDN, un bundle React compilado y una hoja de estilos responsive. No necesita servidor ni base de datos para funcionar: abre `index.html` en un navegador compatible.
