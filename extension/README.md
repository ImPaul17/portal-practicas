# PhoneGest → Séneca (Chrome / Edge)

Extensión de navegador para transferir un día de prácticas desde el portal personal al formulario de **Detalle de actividad diaria del alumnado** de Séneca.

## Instalación

1. Descarga el repositorio: https://github.com/ImPaul17/portal-practicas → **Code → Download ZIP** y descomprímelo.
2. En Chrome abre chrome://extensions/ (o en Edge, edge://extensions/).
3. Activa **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y selecciona la carpeta extension del proyecto.
5. Si actualizas los archivos, pulsa **Actualizar** en la página de extensiones.

## Uso

1. Entra en https://impaul17.github.io/portal-practicas/ con tu usuario y PIN.
2. Abre un día que tenga anotaciones iPasen y al menos una AF. Pulsa **Enviar a Séneca**.
3. Entra **tú** en https://seneca.juntadeandalucia.es/ e inicia sesión normalmente.
4. Ve a **Detalle de actividad diaria del alumnado**, elige la **misma fecha** que enviaste.
5. Pulsa el icono de la extensión **PhoneGest → Séneca** y después **Rellenar formulario abierto**.
6. Revisa presencialidad, horario 09:00–16:00, AF8–AF13 y anotaciones. Si hay advertencias, corrige esos campos manualmente.
7. Finalmente **guarda tú el formulario en Séneca** con el botón oficial.

## Funcionamiento y seguridad

- No solicita, guarda ni transmite la contraseña de Séneca.
- Las transferencias solamente se aceptan desde el origen autorizado del portal personal.
- La extensión conserva un único registro pendiente en la sesión del navegador; el siguiente envío sustituye al anterior.
- El registro pendiente es temporal y se pierde al reiniciar el navegador. No se sincroniza en la nube.
- **Nunca pulsa Guardar**: solo rellena campos y exige comprobar que la fecha de Séneca coincide con la del registro.
- No usa ninguna API no documentada de Séneca ni elimina sus mecanismos de autenticación.
- GitHub Pages sigue siendo público. Los registros del portal y los de la extensión se guardan localmente en el navegador.

## Limitaciones

La automatización se basa en la estructura visual del formulario de las capturas del 20/10/2026. No hay acceso aquí a una sesión autenticada para inspeccionar los atributos HTML reales. **Puede ser necesario adaptar los selectores** de hora, modalidad, AF o anotaciones, especialmente si Séneca carga los controles mediante JavaScript o dentro de iframes.

Si falta rellenar algún campo, la extensión mostrará cuáles debes revisar. Si el formulario cambia, debemos volver a probar el relleno antes de guardar datos.

La extensión requiere la web publicada en GitHub Pages (no funciona con el archivo local file://). Tu copia local de Windows no se sincroniza sola con GitHub Pages: utiliza **Exportar JSON** e **Importar JSON** en Ajustes.
