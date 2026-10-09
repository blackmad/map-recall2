"""Facade coordinate system: metres, +X along frontage, +Y inward, +Z up."""
from dataclasses import dataclass
from math import hypot

@dataclass(frozen=True)
class FacadeFrame:
    origin: tuple
    tangent: tuple
    inward: tuple
    width: float

    @classmethod
    def from_frontage(cls, start, end, inside):
        width = hypot(end[0]-start[0], end[1]-start[1])
        if width <= .01: raise ValueError('Degenerate frontage')
        u = ((end[0]-start[0])/width, (end[1]-start[1])/width)
        v = (-u[1],u[0])
        if sum((inside[i]-start[i])*v[i] for i in (0,1)) < 0:
            # Explicitly record reflection imposed by source's north-down local frame.
            v = (-v[0],-v[1])
        return cls(tuple(start),u,v,width)

    @property
    def determinant(self): return self.tangent[0]*self.inward[1]-self.tangent[1]*self.inward[0]
    def local(self, p):
        d = [p[i]-self.origin[i] for i in (0,1)]
        return [sum(d[i]*a[i] for i in (0,1)) for a in (self.tangent,self.inward)]
    def world(self, p):
        return [self.origin[i]+self.tangent[i]*p[0]+self.inward[i]*p[1] for i in (0,1)]
