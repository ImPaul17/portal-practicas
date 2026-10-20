# PhoneGest · Portal de prácticas

Portal web local para registrar las prácticas de empresa entre el **5 de octubre y el 18 de diciembre de 2026**.

## Uso

1. Abre `index.html` en Chrome, Edge o Firefox.
2. Selecciona un día desde el calendario o desde la lista lateral.
3. Escribe una tarea por línea en GitLab y/o iPasen.
4. Selecciona una o varias actividades AF8–AF13.
5. Añade etiquetas y pulsa **Guardar día**.

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
- Jornada fija: 09:00 → 15:00, 6 horas.
- Fines de semana excluidos.
- Festivos excluidos: 12/10, 02/11, 07/12 y 08/12.
- Total: 51 días laborables / 306 horas.

## Acciones rápidas

Haz **clic derecho** sobre un día laborable para:
- Abrir el día.
- Copiar GitLab.
- Copiar iPasen.
- Copiar el contenido del día laborable anterior.
- Vaciar el día.

## Datos

Los registros se guardan en `localStorage` del navegador. En **Ajustes** puedes exportar/importar una copia JSON.

No requiere servidor ni base de datos para funcionar.
