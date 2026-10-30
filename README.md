# PhoneGest · Portal de prácticas

Portal local para registrar las prácticas de empresa entre el **5 de octubre y el 18 de diciembre de 2026**.

## Flujo

- **Inicio** reúne bienvenida, próximo día, contadores, horas, AF trabajadas y actividad reciente.
- **Abrir día de hoy** abre la jornada actual; el calendario permite elegir otra fecha laborable.
- Al añadir contenido, la jornada se guarda automáticamente y aparece en **Días abiertos**. Los días cerrados se agrupan en un desplegable lateral.
- Desde la página de una jornada puedes editar GitLab, iPasen, horario y actividades formativas.
- **Cerrar día** bloquea el registro y actualiza el progreso. Puedes **Reabrir día** para corregirlo.
- **Calendario** es interactivo: haz clic en cualquier día laborable para abrir su página o haz clic derecho para ver sus acciones.
- **Resumen** muestra días restantes, jornadas cerradas y cobertura AF8–AF13.

## Datos

Los registros se guardan en `localStorage` del navegador. Si existe una bóveda cifrada de la versión anterior, se solicita el PIN anterior y las modificaciones siguen guardándose cifradas. En **Ajustes** puedes cambiar el nombre y el horario habitual, exportar una copia JSON o importar datos guardados anteriormente.

El botón **Enviar a Séneca** mantiene el puente de mensajes que utiliza la extensión de la carpeta `extension`.

## Desarrollo

La interfaz usa React 18 cargado desde CDN, un bundle React compilado y una hoja de estilos responsive. El efecto [Liquid Glass](https://liquid-glass.ybouane.com/) usa WebGL en el fondo, con superficies translúcidas en toda la interfaz y una alternativa CSS si la biblioteca no está disponible. No necesita servidor ni base de datos; los recursos CDN requieren conexión.
