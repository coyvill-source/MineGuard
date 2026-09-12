from pydantic import BaseModel


class IngestaArchivoRespuesta(BaseModel):
    filas_procesadas: int
    filas_descartadas: int
    punto_control_id: int
