# PhoneGest · Portal de prácticas

Portal web local para registrar las prácticas de empresa entre el **5 de octubre y el 18 de diciembre de 2026**.

## Uso

1. Abre la versión publicada en GitHub Pages con HTTPS o `index.html` en un navegador compatible.
2. Crea un usuario y un PIN de 4 a 8 dígitos en el primer acceso.
3. En posteriores visitas, introduce el mismo usuario y PIN para abrir el portal.
4. Selecciona un día desde el calendario o desde la lista lateral.
5. Escribe una tarea por línea en GitLab y/o iPasen.
6. Selecciona una o varias actividades AF8–AF13.
7. Añade etiquetas y pulsa **Guardar día**.

## Formato automático

### GitLab

El botón **Copiar** produce automáticamente:

```md
### 28 de Mayo

```
Pablo
- Primera tarea
- Segunda tarea
```
```

El nombre se puede cambiar en **Ajustes**.

### iPasen

El botón **Copiar** genera únicamente una lista:

```text
- Primera actividad
- Segunda actividad
```

## Calendario

- Periodo: 05/10/2026 → 18/12/2026.
- Jornada fija: 09:00 → 16:00, 7 horas.
- Fines de semana excluidos.
- Festivos excluidos: 12/10, 02/11, 07/12 y 08/12.
- Total: 51 días laborables / 357 horas.

## Acciones rápidas

Haz **clic derecho** sobre un día laborable para:
- Abrir el día.
- Copiar GitLab.
- Copiar iPasen.
- Copiar el contenido del día laborable anterior.
- Vaciar el día.

## Datos

Los registros se cifran con AES-GCM (clave derivada del PIN con PBKDF2) y se almacenan en `localStorage` del navegador. El acceso es **local**, no una cuenta online ni una autenticación de servidor: GitHub Pages continúa siendo público, y un PIN corto no protege frente a ataques exhaustivos sobre los datos cifrados.

Los registros antiguos sin cifrar del mismo origen web se migran tras crear el acceso. Los registros de `file://` u otro dominio **no pasan automáticamente** a GitHub Pages. En la copia anterior utiliza **Ajustes → Exportar JSON** y en la nueva **Ajustes → Importar JSON**. Se recomienda crear una copia de seguridad antes de importar: la importación sustituye el conjunto existente.

El usuario y PIN deben configurarse en cada navegador por separado. Si pierdes el PIN no hay recuperación automática de los registros cifrados: guarda copias JSON en un lugar seguro. El formulario está accesible en GitHub Pages con HTTPS.

No requiere servidor ni base de datos para funcionar.
