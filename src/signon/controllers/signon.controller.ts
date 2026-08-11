import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { SignonService } from '../services/signon.service';

@ApiTags('Sign On')
@Controller('/signon')
export class SignonController {
  constructor(private readonly signonService: SignonService) {}

  @Get()
  getSignon(@Req() req: Request, @Res() res: Response) {
    const requestBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : '');

    // We know how to parse the signon request body,
    // but we have no use for it currently.
    this.signonService.parseSignonRequest(requestBody);

    const body = this.signonService.buildSuccessSignonResponse();
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Length', body.length.toString());
    return res.status(200).send(body);
  }
}
